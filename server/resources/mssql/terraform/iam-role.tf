resource "aws_iam_role" "ec2_iam_role" {
  depends_on = [null_resource.validation]
  name       = var.deployment_name
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Principal = {
          Service = "ec2.amazonaws.com"
        }
        Effect = "Allow"
      }
    ]
  })
  path = "/"
  tags = {
    tag-key = var.creator_tag
  }
}


