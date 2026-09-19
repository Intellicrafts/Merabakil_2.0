# Use official Playwright Python image
FROM mcr.microsoft.com/playwright/python:v1.41.0-jammy

# --- AWS Lambda Adapter ---
# This allows running the standard FastAPI app on Lambda without code changes
COPY --from=public.ecr.aws/awsguru/aws-lambda-adapter:0.8.1 /lambda-adapter /opt/extensions/lambda-adapter

# Set working directory
WORKDIR /app

# Environment Variables for Playwright on Lambda
# 1. Store browsers in a specific location
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
# 2. Set HOME to /tmp because Lambda root is read-only
ENV HOME=/tmp
# 3. Tell Lambda Adapter that app listens on 8000
ENV AWS_LWA_PORT=8000

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Install Playwright browsers to the custom path
RUN playwright install chromium

# Copy application code
COPY . .

# Generate keys during build (simplest for this setup)
RUN python scripts/gen_keys.py

# Expose port 8000
EXPOSE 8000

# Command to run the application
# Note: The Lambda Adapter listens on port 8000 (default) and forwards events
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
