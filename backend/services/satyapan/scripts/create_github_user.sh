#!/bin/bash

# Configuration
USER_NAME="satyapan-github-deployer"
GROUP_NAME="SatyapanDeployers"

echo "--- Creating Dedicated IAM User for GitHub Actions ---"

# 1. Create User
if ! aws iam get-user --user-name $USER_NAME > /dev/null 2>&1; then
    echo "Creating user: $USER_NAME"
    aws iam create-user --user-name $USER_NAME
else
    echo "User $USER_NAME already exists."
fi

# 2. Attach Policies (AdministratorAccess for simplicity in this demo)
# In production, you should scope this down to ECR, Lambda, and IAM PassRole.
echo "Attaching AdministratorAccess policy..."
aws iam attach-user-policy --user-name $USER_NAME --policy-arn arn:aws:iam::aws:policy/AdministratorAccess

# 3. Create Access Key
echo "Creating Access Key..."
aws iam create-access-key --user-name $USER_NAME > satyapan_github_keys.json

echo "\n✅ User Created and Keys Generated!"
echo "Keys are saved in 'satyapan_github_keys.json'. DO NOT COMMIT THIS FILE."
echo "\n--- AWS_ACCESS_KEY_ID ---"
jq -r '.AccessKey.AccessKeyId' satyapan_github_keys.json
echo "\n--- AWS_SECRET_ACCESS_KEY ---"
jq -r '.AccessKey.SecretAccessKey' satyapan_github_keys.json

echo "\n⚠️  Copy these values to GitHub Secrets and then delete the json file."
