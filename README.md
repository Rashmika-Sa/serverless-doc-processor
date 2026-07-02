# Serverless Document/Image Processor

A serverless AWS pipeline for compressing images, extracting text (OCR), and watermarking documents — built with Terraform, Lambda, S3, DynamoDB, and Next.js.

## Status
🚧 In progress

## Architecture
- **Frontend**: Next.js
- **Storage**: AWS S3
- **Compute**: AWS Lambda (Node.js)
- **Database**: AWS DynamoDB (job status tracking)
- **Infrastructure**: Terraform