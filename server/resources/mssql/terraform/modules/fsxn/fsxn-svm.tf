resource "aws_fsx_ontap_storage_virtual_machine" "fsx_svm_01" {
  file_system_id             = local.fsx_is_existing ? var.fsx_file_system_id : aws_fsx_ontap_file_system.fsx_ontap_fs[0].id
  name                       = var.fsx_svm_name
  root_volume_security_style = var.fsxn_volume_security_style
}

