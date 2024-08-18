output "instance_id" {
  description = "The ID of the instance"
  value       = aws_instance.validation_node.id
}

output "instance_public_ip" {
  description = "The public IP of the instance"
  value       = aws_instance.validation_node.public_ip
}

output "instance_private_ip" {
  description = "The private IP of the instance"
  value       = aws_instance.validation_node.private_ip
}

output "instance_state" {
  description = "The state of the instance"
  value       = aws_instance.validation_node.instance_state
}
