terraform {

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "5.25.0"
    }
    local = {
      source  = "hashicorp/local"
      version = "2.5.1"
    }
  }

}

provider "aws" {
  region = var.aws_location

  default_tags {
   tags = {
      "creator" = var.creator_tag
    }
  }
}