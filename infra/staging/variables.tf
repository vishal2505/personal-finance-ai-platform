variable "aws_region" {
  type    = string
  default = "ap-southeast-1" # Singapore
}

variable "project_name" {
  type    = string
  default = "personal-finance-ai-platform"
}

variable "env" {
  type    = string
  default = "staging"
}

# ECS EC2 instance type for low cost
variable "ecs_instance_type" {
  type    = string
  default = "t3.micro"
}

# Test container image (you can replace with your ECR image later)
variable "container_image" {
  type    = string
  default = "nginx:latest"
}

variable "container_port" {
  type    = number
  default = 8000
}

variable "cors_origins" {
  type    = string
  default = "http://localhost:3000,http://localhost:5173"
}

# RDS MySQL settings (free-tier friendly)
variable "db_name" {
  type    = string
  default = "spendwise_db"
}

variable "db_username" {
  type    = string
  default = "pfai_admin"
}

variable "db_password" {
  type      = string
  sensitive = true
}

variable "db_instance_class" {
  type    = string
  default = "db.t3.micro"
}
