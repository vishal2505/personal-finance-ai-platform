# Personal Finance App AWS Architecture

```mermaid
flowchart LR
  subgraph dev[Developer + CI/CD]
    gh[GitHub Actions]
    ecr[ECR: Backend Image]
  end

  subgraph aws[AWS - ap-southeast-1]
    subgraph net[Default VPC]
      alb[ALB (HTTP 80)]
      ecsasg[EC2 Auto Scaling Group]
      ecs[ECS Cluster (EC2)]
      rds[RDS MySQL]
    end

    subgraph storage[S3]
      s3fe[S3 Bucket: Frontend Static Site]
      s3st[S3 Bucket: Statement Uploads]
    end

    subgraph edge[CloudFront]
      cf_front[CloudFront: Frontend HTTPS]
      cf_api[CloudFront: Backend HTTPS]
    end

    cw[CloudWatch Logs]
  end

  user[User Browser]

  gh --> ecr
  gh --> tf[Terraform Apply]
  tf --> alb
  tf --> ecs
  tf --> rds
  tf --> s3fe
  tf --> s3st
  tf --> cf_front
  tf --> cf_api

  ecr --> ecs

  user --> cf_front
  cf_front --> s3fe

  user --> cf_api
  cf_api --> alb
  alb --> ecs
  ecs --> rds
  ecs --> cw
  ecs --> s3st

  s3fe -. deploy .-> gh
```
