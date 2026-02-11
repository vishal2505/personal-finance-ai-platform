output "ecs_cluster_name" {
  value = aws_ecs_cluster.this.name
}

output "rds_endpoint" {
  value = aws_db_instance.mysql.address
}

output "frontend_bucket_name" {
  value = aws_s3_bucket.frontend.bucket
}

output "frontend_website_url" {
  value = aws_s3_bucket_website_configuration.frontend.website_endpoint
}

output "how_to_access_app" {
  value = "Find the ECS EC2 instance public IP in the EC2 console. Open http://<PUBLIC_IP>/"
}
