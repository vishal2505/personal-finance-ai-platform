locals {
  name_prefix = "${var.project_name}-${var.env}"
}

# -----------------------------
# Networking (Default VPC and subnets)
# -----------------------------
data "aws_vpc" "default" {
  default = true
}

data "aws_subnets" "default" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.default.id]
  }
}


# -----------------------------
# Security Groups
# -----------------------------
# ECS host SG: allow HTTP from internet (demo)
resource "aws_security_group" "ecs_host_sg" {
  name        = "${local.name_prefix}-ecs-host-sg"
  description = "ECS host SG"
  vpc_id      = data.aws_vpc.default.id

  ingress {
    description = "HTTP for demo"
    from_port   = var.container_port
    to_port     = var.container_port
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # optional SSH - safer to keep disabled; enable only if you need it
  # ingress {
  #   from_port   = 22
  #   to_port     = 22
  #   protocol    = "tcp"
  #   cidr_blocks = ["YOUR_IP/32"]
  # }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

# RDS SG: only allow MySQL from ECS host SG
resource "aws_security_group" "rds_sg" {
  name        = "${local.name_prefix}-rds-sg"
  description = "RDS SG"
  vpc_id      = data.aws_vpc.default.id

  ingress {
    description     = "MySQL from ECS host"
    from_port       = 3306
    to_port         = 3306
    protocol        = "tcp"
    security_groups = [aws_security_group.ecs_host_sg.id]
  }

  ingress {
    description = "MySQL from local IP (demo)"
    from_port   = 3306
    to_port     = 3306
    protocol    = "tcp"
    cidr_blocks = ["42.60.170.187/32"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

# -----------------------------
# ECS on EC2 (cheap)
# -----------------------------
resource "aws_ecs_cluster" "this" {
  name = "${local.name_prefix}-cluster"
}

# IAM role for ECS EC2 instance
data "aws_iam_policy_document" "ecs_instance_assume" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["ec2.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "ecs_instance_role" {
  name               = "${local.name_prefix}-ecs-instance-role"
  assume_role_policy = data.aws_iam_policy_document.ecs_instance_assume.json
}

resource "aws_iam_role_policy_attachment" "ecs_instance_attach" {
  role       = aws_iam_role.ecs_instance_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonEC2ContainerServiceforEC2Role"
}

resource "aws_iam_instance_profile" "ecs_instance_profile" {
  name = "${local.name_prefix}-ecs-instance-profile"
  role = aws_iam_role.ecs_instance_role.name
}

# Find latest ECS-optimized Amazon Linux 2 AMI
data "aws_ami" "ecs_optimized" {
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["amzn2-ami-ecs-hvm-*-x86_64-ebs"]
  }
}

resource "aws_launch_template" "ecs_lt" {
  name_prefix   = "${local.name_prefix}-ecs-lt-"
  image_id      = data.aws_ami.ecs_optimized.id
  instance_type = var.ecs_instance_type

  iam_instance_profile {
    name = aws_iam_instance_profile.ecs_instance_profile.name
  }

  vpc_security_group_ids = [aws_security_group.ecs_host_sg.id]

  user_data = base64encode(templatefile("${path.module}/user_data.sh", {
    ecs_cluster_name = aws_ecs_cluster.this.name
  }))

}

resource "aws_autoscaling_group" "ecs_asg" {
  name                = "${local.name_prefix}-ecs-asg"
  desired_capacity    = 1
  max_size            = 1
  min_size            = 1
  vpc_zone_identifier = data.aws_subnets.default.ids

  launch_template {
    id      = aws_launch_template.ecs_lt.id
    version = "$Latest"
  }

  tag {
    key                 = "Name"
    value               = "${local.name_prefix}-ecs-host"
    propagate_at_launch = true
  }
}


# Task execution role (needed even without ECR; good practice)
data "aws_iam_policy_document" "task_assume" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["ecs-tasks.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "task_execution_role" {
  name               = "${local.name_prefix}-task-exec-role"
  assume_role_policy = data.aws_iam_policy_document.task_assume.json
}

resource "aws_iam_role_policy_attachment" "task_exec_attach" {
  role       = aws_iam_role.task_execution_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

# CloudWatch logs
resource "aws_cloudwatch_log_group" "app_lg" {
  name              = "/ecs/${local.name_prefix}"
  retention_in_days = 7
}

resource "aws_ecs_task_definition" "app" {
  family                   = "${local.name_prefix}-task"
  requires_compatibilities = ["EC2"]
  network_mode             = "bridge"
  cpu                      = "256"
  memory                   = "256"
  execution_role_arn       = aws_iam_role.task_execution_role.arn

  container_definitions = jsonencode([
    {
      name  = "app"
      image = var.container_image
      essential = true
      portMappings = [
        { containerPort = var.container_port, hostPort = var.container_port, protocol = "tcp" }
      ]
      environment = [
        { name = "DB_HOST", value = aws_db_instance.mysql.address },
        { name = "DB_NAME", value = var.db_name },
        { name = "DB_USER", value = var.db_username },
        { name = "DB_PASSWORD", value = var.db_password },
        { name = "DB_PORT", value = "3306" },
        { name = "CORS_ORIGINS", value = var.cors_origins }
      ]
      # NOTE: do NOT hardcode password; use Secrets Manager later when your backend needs it.
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          awslogs-group         = aws_cloudwatch_log_group.app_lg.name
          awslogs-region        = var.aws_region
          awslogs-stream-prefix = "app"
        }
      }
    }
  ])
}

resource "aws_ecs_service" "app" {
  name            = "${local.name_prefix}-svc"
  cluster         = aws_ecs_cluster.this.id
  task_definition = aws_ecs_task_definition.app.arn
  desired_count   = 1

  # Single-instance rolling updates: stop old task before starting new one.
  deployment_minimum_healthy_percent = 0
  deployment_maximum_percent         = 100

  launch_type = "EC2"

  depends_on = [aws_db_instance.mysql]
}

# -----------------------------
# RDS MySQL (free-tier friendly)
# -----------------------------
resource "aws_db_subnet_group" "db_subnets" {
  name       = "${local.name_prefix}-db-subnets"
  subnet_ids = data.aws_subnets.default.ids
}

resource "aws_db_instance" "mysql" {
  identifier             = "${local.name_prefix}-mysql"
  engine                 = "mysql"
  engine_version         = "8.0"
  instance_class         = var.db_instance_class
  allocated_storage      = 20
  storage_type           = "gp2"
  db_name                = var.db_name
  username               = var.db_username
  password               = var.db_password
  skip_final_snapshot    = true

  publicly_accessible    = true
  vpc_security_group_ids = [aws_security_group.rds_sg.id]
  db_subnet_group_name   = aws_db_subnet_group.db_subnets.name

  # keep costs down in staging
  backup_retention_period = 0
}

# -----------------------------
# S3 for statement uploads
# -----------------------------
resource "aws_s3_bucket" "statements" {
  bucket = "${local.name_prefix}-statements"
}

# -----------------------------
# S3 static site for frontend (demo)
# -----------------------------
resource "aws_s3_bucket" "frontend" {
  bucket = "${local.name_prefix}-frontend"
}

resource "aws_s3_bucket_website_configuration" "frontend" {
  bucket = aws_s3_bucket.frontend.id

  index_document {
    suffix = "index.html"
  }

  error_document {
    key = "index.html"
  }
}

resource "aws_s3_bucket_public_access_block" "frontend" {
  bucket                  = aws_s3_bucket.frontend.id
  block_public_acls       = false
  block_public_policy     = false
  ignore_public_acls      = false
  restrict_public_buckets = false
}

data "aws_iam_policy_document" "frontend_public_read" {
  statement {
    effect = "Allow"
    principals {
      type        = "*"
      identifiers = ["*"]
    }
    actions   = ["s3:GetObject"]
    resources = ["${aws_s3_bucket.frontend.arn}/*"]
  }
}

resource "aws_s3_bucket_policy" "frontend" {
  bucket = aws_s3_bucket.frontend.id
  policy = data.aws_iam_policy_document.frontend_public_read.json

  depends_on = [aws_s3_bucket_public_access_block.frontend]
}
