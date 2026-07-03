variable "project_name" {
  description = "Prefix used for naming all resources in this project"
  type        = string
  default     = "docprocessor-rash"
}

variable "aws_region" {
  description = "AWS region to deploy into"
  type        = string
  default     = "ap-south-1"
}