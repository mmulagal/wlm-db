output "sql_node_instance_id" {
  description = "The ID of the SQL node instance"
  value       = aws_instance.sql_node.id
}

output "sql_node_instance_name" {
  description = "The name of the SQL node instance"
  value       = aws_instance.sql_node.tags["Name"]
}

output "sql_node_private_ip" {
  description = "The private IP address of the SQL node instance"
  value       = aws_instance.sql_node.private_ip
}

output "sql_workload_security_group_id" {
  description = "The ID of the workload security group"
  value       = aws_security_group.workload_security_group.id
}

output "sql_workload_security_group_arn" {
  description = "The ARN of the workload security group"
  value       = aws_security_group.workload_security_group.arn
}
