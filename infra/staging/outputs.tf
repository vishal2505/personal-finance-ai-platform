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

output "frontend_cloudfront_url" {
  value = "https://${aws_cloudfront_distribution.frontend.domain_name}"
}

output "backend_cloudfront_url" {
  value = "https://${aws_cloudfront_distribution.backend.domain_name}"
}

output "alb_dns_name" {
  value = aws_lb.app.dns_name
}

output "how_to_access_app" {
  value = "Use the CloudFront HTTPS URL from frontend_cloudfront_url. Backend HTTPS is backend_cloudfront_url."
}
