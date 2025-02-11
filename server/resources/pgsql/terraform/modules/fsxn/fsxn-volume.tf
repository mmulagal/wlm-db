resource "aws_fsx_ontap_volume" "fsx_data_volume" {
  name                       = var.fsx_data_volume_name
  junction_path              = "/${var.fsx_data_volume_name}"
  security_style             = "UNIX"
  size_in_megabytes          = var.fsx_data_volume_size
  storage_efficiency_enabled = true
  storage_virtual_machine_id = aws_fsx_ontap_storage_virtual_machine.fsx_svm_01.id
  ontap_volume_type          = "RW"
  volume_type                = "ONTAP"
  tiering_policy {
    name           = "SNAPSHOT_ONLY"
    cooling_period = 7
  }
}

resource "aws_fsx_ontap_volume" "fsx_log_volume" {
  name                       = var.fsx_log_volume_name
  junction_path              = "/${var.fsx_log_volume_name}"
  security_style             = "UNIX"
  size_in_megabytes          = var.fsx_log_volume_size
  storage_efficiency_enabled = true
  storage_virtual_machine_id = aws_fsx_ontap_storage_virtual_machine.fsx_svm_01.id
  ontap_volume_type          = "RW"
  volume_type                = "ONTAP"
  tiering_policy {
    name           = "SNAPSHOT_ONLY"
    cooling_period = 7
  }
}



