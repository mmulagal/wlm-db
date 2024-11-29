output "https_security_group_id" {
  value = local.create_sg ? aws_security_group.https_security_group[0].id : null
}

output "s3_endpoint_id" {
  value = aws_vpc_endpoint.s3_endpoint[*].id
}
output "ssm_endpoint_id" {
  value = aws_vpc_endpoint.ssm_endpoint[*].id
}

output "ssm_messages_endpoint_id" {
  value = aws_vpc_endpoint.ssm_messages_endpoint[*].id
}

output "ec2_messages_endpoint_id" {
  value = aws_vpc_endpoint.ec2_messages_endpoint[*].id
}

output "cloudwatch_logs_endpoint_id" {
  value = aws_vpc_endpoint.cloudwatch_logs_endpoint[*].id
}

output "fsx_endpoint_id" {
  value = aws_vpc_endpoint.fsx_endpoint[*].id
}

output "ec2_endpoint_id" {
  value = aws_vpc_endpoint.ec2_endpoint[*].id
}
