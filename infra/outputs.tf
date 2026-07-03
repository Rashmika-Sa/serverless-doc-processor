output "raw_bucket_name" {
  value = aws_s3_bucket.raw_uploads.bucket
}

output "processed_bucket_name" {
  value = aws_s3_bucket.processed_files.bucket
}

output "dynamodb_table_name" {
  value = aws_dynamodb_table.job_status.name
}