resource "aws_dynamodb_table" "job_status" {
  name         = "${var.project_name}-job-status"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "job_id"

  attribute {
    name = "job_id"
    type = "S"
  }
}