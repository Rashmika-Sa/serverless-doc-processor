resource "aws_s3_bucket" "raw_uploads" {
  bucket = "${var.project_name}-raw-uploads-2026"
}

resource "aws_s3_bucket" "processed_files" {
  bucket = "${var.project_name}-processed-files-2026"
}