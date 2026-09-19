#!/bin/bash

# Configuration
REPO_NAME=${1:-"satyapan"}
REGION=${2:-"ap-south-1"}

# Check AWS authentication
if ! aws sts get-caller-identity > /dev/null 2>&1; then
    echo "Please configure AWS CLI first: aws configure"
    exit 1
fi

# Load variables from .env
if [ -f .env ]; then
    export $(cat .env | xargs)
fi

echo "--- Starting AWS Deployment Setup ---"
echo "Repository: $REPO_NAME"
echo "Region: $REGION"

# 1. Get Account ID
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
ECR_REGISTRY="$ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com"
IMAGE_URI="$ECR_REGISTRY/$REPO_NAME:latest"

echo "Account ID: $ACCOUNT_ID"

# 2. Create ECR Repo (if not exists)
echo "\n--- Checking ECR Repository ---"
if ! aws ecr describe-repositories --repository-names $REPO_NAME --region $REGION > /dev/null 2>&1; then
    echo "Creating repository..."
    aws ecr create-repository --repository-name $REPO_NAME --region $REGION
else
    echo "Repository exists."
fi

# 3. Login to ECR
echo "\n--- Logging into ECR ---"
aws ecr get-login-password --region $REGION | docker login --username AWS --password-stdin $ECR_REGISTRY

# 4. Build and Push
echo "\n--- Building and Pushing Image ---"
docker build --platform linux/amd64 --provenance=false -t $REPO_NAME .
docker tag $REPO_NAME:latest $IMAGE_URI
docker push $IMAGE_URI

echo "\n--- Image Pushed: $IMAGE_URI ---"

# 5. Deploy to AWS Lambda
echo "\n--- Deploying to AWS Lambda ---"

FUNCTION_NAME="satyapan-api"
ROLE_NAME="SatyapanLambdaRole"

# 5.1 Ensure IAM Role Exists
echo "Checking IAM Role..."
if ! aws iam get-role --role-name $ROLE_NAME > /dev/null 2>&1; then
    echo "Creating IAM Role: $ROLE_NAME"
    TRUST_POLICY='{
      "Version": "2012-10-17",
      "Statement": [
        {
          "Effect": "Allow",
          "Principal": {
            "Service": "lambda.amazonaws.com"
          },
          "Action": "sts:AssumeRole"
        }
      ]
    }'
    aws iam create-role --role-name $ROLE_NAME --assume-role-policy-document "$TRUST_POLICY"
    echo "Attaching BasicExecutionRole policy..."
    aws iam attach-role-policy --role-name $ROLE_NAME --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole
    
    echo "Waiting 10s for role propagation..."
    sleep 10
else
    echo "Role $ROLE_NAME exists."
fi

ROLE_ARN=$(aws iam get-role --role-name $ROLE_NAME --query Role.Arn --output text)

# 5.2 Create/Update Function
# Check if function exists
if ! aws lambda get-function --function-name $FUNCTION_NAME --region $REGION > /dev/null 2>&1; then
    echo "Creating new Lambda function..."
    aws lambda create-function \
        --function-name $FUNCTION_NAME \
        --package-type Image \
        --code ImageUri=$IMAGE_URI \
        --role $ROLE_ARN \
        --timeout 60 \
        --memory-size 2048 \
        --environment "Variables={ADMIN_USERNAME=$ADMIN_USERNAME,ADMIN_PASSWORD=$ADMIN_PASSWORD,HOME=/tmp}" \
        --region $REGION
else
    echo "Updating existing function..."
    aws lambda update-function-code \
        --function-name $FUNCTION_NAME \
        --image-uri $IMAGE_URI \
        --region $REGION > /dev/null
        
    # Wait for update
    aws lambda wait function-updated --function-name $FUNCTION_NAME --region $REGION
    
    # Update config (env vars)
    aws lambda update-function-configuration \
        --function-name $FUNCTION_NAME \
        --timeout 60 \
        --memory-size 2048 \
        --environment "Variables={ADMIN_USERNAME=$ADMIN_USERNAME,ADMIN_PASSWORD=$ADMIN_PASSWORD,HOME=/tmp}" \
        --region $REGION > /dev/null
fi

# 6. Create Function URL (Public Endpoint)
echo "\n--- Configuring Function URL ---"
if ! aws lambda get-function-url-config --function-name $FUNCTION_NAME --region $REGION > /dev/null 2>&1; then
    aws lambda create-function-url-config \
        --function-name $FUNCTION_NAME \
        --auth-type NONE \
        --region $REGION
        
    aws lambda add-permission \
        --function-name $FUNCTION_NAME \
        --action lambda:InvokeFunctionUrl \
        --statement-id FunctionURLAllowPublicAccess \
        --principal "*" \
        --function-url-auth-type NONE \
        --region $REGION
fi

FUNC_URL=$(aws lambda get-function-url-config --function-name $FUNCTION_NAME --region $REGION --query FunctionUrl --output text)
echo "\n✅ Deployment Complete!"
echo "API Endpoint: $FUNC_URL"
echo "Docs: ${FUNC_URL}docs"
