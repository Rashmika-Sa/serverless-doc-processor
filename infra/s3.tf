resource "aws_s3_bucket" "raw_uploads" {
  bucket = "${var.project_name}-raw-uploads-2026"
}

resource "aws_s3_bucket" "processed_files" {
  bucket = "${var.project_name}-processed-files-2026"
}
resource "aws_s3_bucket_cors_configuration" "raw_uploads_cors" {
  bucket = aws_s3_bucket.raw_uploads.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["PUT", "GET"]
    allowed_origins = ["http://localhost:3000"]
    expose_headers  = ["ETag"]
    max_age_seconds = 3000
  }
}