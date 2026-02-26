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

## AWS Architecture
See the diagram in [architecture/aws-architecture.md](architecture/aws-architecture.md).

## Deployment (AWS demo)

This project deploys the backend to ECS on EC2 and the frontend to S3, with HTTPS provided by CloudFront for both frontend and backend (no custom domain required).

1. Configure GitHub Actions secrets (used by [.github/workflows/deploy.yml](.github/workflows/deploy.yml)):
- AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION
- ECR_REPO
- TF_STATE_BUCKET, TF_STATE_KEY, TF_STATE_LOCK_TABLE
- S3_BUCKET (frontend)

2. Update Terraform variables in [infra/staging/terraform.tfvars](infra/staging/terraform.tfvars):
```hcl
container_image = "<aws_account_id>.dkr.ecr.<region>.amazonaws.com/pfai-backend:latest"
db_password     = "<your-rds-password>"
cors_origins    = ""
```

3. Run the deployment via GitHub Actions:
- Push to main, or run the workflow manually and set the ref to your branch.
- The workflow builds/pushes the backend image, runs terraform apply, then builds the frontend with the backend HTTPS URL and syncs to S3.

4. Get the HTTPS URLs from Terraform outputs:
```bash
cd infra/staging
terraform output -raw frontend_cloudfront_url
terraform output -raw backend_cloudfront_url
```

Notes:
- CloudFront provides the HTTPS endpoints without a custom domain.
- Set cors_origins to a comma-separated list only if you want to override the default frontend CloudFront URL.

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

