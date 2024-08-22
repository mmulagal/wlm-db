output "sql_node_instance_id" {
  description = "The ID of the SQL node instance"
  value       = aws_instance.sql_node.id
}

output "sql_node_instance_name" {
  description = "The name of the SQL node instance"
  value       = aws_instance.sql_node.tags["Name"]
}
