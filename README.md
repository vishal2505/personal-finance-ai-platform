# Personal Finance AI Platform

This repository contains a collaborative project developed as part of the  
**SMU – Modern Software Solution Development** course.

## Project Overview
The Personal Finance AI Platform allows users to:
- Import monthly credit card statements (PDF/CSV)
- Consolidate expenses across multiple banks and cards
- Automatically categorize transactions
- Detect anomalous or unusual spending
- Generate AI-driven insights, budgets, and goals

## Key Constraint
Due to the lack of public consumer APIs from most Singapore banks, credit card
statements are imported through secure manual upload workflows.

## Planned Tech Stack
- Frontend: React
- Backend: FastAPI (Python)
- Database: MySQL (RDS)
- AI Services: LLM-based insight generation
- CI/CD: GitHub Actions
- Deployment: Public cloud

## Deployment (AWS demo)

This project deploys the backend to ECS on EC2 and the frontend as a static site on S3 to keep costs minimal.

1. Build and push the backend container to ECR:
```bash
aws ecr create-repository --repository-name pfai-backend --region ap-southeast-1    ## first time create ecr repo
docker build -t pfai-backend ./personal-finance-ai-platform/backend
docker tag pfai-backend:latest 503382476502.dkr.ecr.ap-southeast-1.amazonaws.com/pfai-backend:latest

aws ecr get-login-password --region ap-southeast-1 | docker login --username AWS --password-stdin 503382476502.dkr.ecr.ap-southeast-1.amazonaws.com
docker push 503382476502.dkr.ecr.ap-southeast-1.amazonaws.com/pfai-backend:latest
```

2. Update Terraform variables in [infra/staging/terraform.tfvars](infra/staging/terraform.tfvars):
```hcl
container_image = "<aws_account_id>.dkr.ecr.<region>.amazonaws.com/pfai-backend:latest"
db_password     = "<your-rds-password>"
cors_origins    = "http://<frontend-website-endpoint>"
```

3. Apply Terraform:
```bash
cd infra/staging
terraform apply
```

4. Find the backend public URL:
- In the EC2 console, locate the ECS instance public IP
- Backend URL is http://<EC2_PUBLIC_IP>:8000

5. Build the frontend and upload to S3:
```bash
cd personal-finance-ai-platform/frontend
VITE_API_BASE_URL=http://<EC2_PUBLIC_IP>:8000 npm run build
aws s3 sync dist s3://<frontend_bucket_name> --delete
```

Notes:
- S3 static website uses http, not https
- CORS must include the S3 website endpoint domain
- If account-level S3 public access is blocked, allow public reads for the frontend bucket

## Local Testing (Docker)

Prereqs: Docker Desktop (includes Docker Compose).

If Docker is not installed:
- macOS: https://docs.docker.com/desktop/install/mac-install/
- Windows: https://docs.docker.com/desktop/install/windows-install/

1. Build and run the backend + frontend + MySQL locally:
```bash
cd personal-finance-ai-platform
docker compose up -d --build
```

2. Verify services:
- Backend: http://localhost:8000
- API docs: http://localhost:8000/docs
- Frontend: http://localhost:5173

3. Stop the stack:
```bash
docker compose down
```

If something is not loading, check logs:
```bash
docker compose logs -f
```

You can also view logs for a single service:
```bash
docker compose logs -f backend
docker compose logs -f frontend
docker compose logs -f db
```

If you want to run only the frontend service:
```bash
cd personal-finance-ai-platform
docker compose up -d frontend
```

## Team

