# Serverless Image Processor

A serverless pipeline on AWS that compresses and watermarks images automatically. Upload an image through the web UI, and within seconds you get back a resized, watermarked, compressed version — no server to manage, no request ever blocks waiting for processing.

## What it does

1. You drop an image into the web app.
2. The app asks the backend for a **presigned S3 URL** and uploads the file directly to S3 (never through the app server).
3. The upload triggers an **S3 event notification**, which invokes a **Lambda function**.
4. Lambda downloads the image, resizes it, composites a watermark onto it, and compresses it with [Sharp](https://sharp.pixelplumbing.com/).
5. Job progress (`awaiting_upload` → `processing` → `done`/`failed`) is tracked in **DynamoDB**.
6. The frontend polls the job status every 2 seconds and, once done, shows a link to download the processed image via another presigned URL.

## Architecture

```
Browser
  │ 1. request presigned upload URL
  ▼
Next.js API routes ──► DynamoDB (job status)
  │ 2. PUT file directly to S3
  ▼
S3 (raw-uploads bucket)
  │ 3. ObjectCreated event
  ▼
Lambda (resize + watermark + compress via Sharp)
  │ 4. write result
  ▼
S3 (processed-files bucket)          Lambda also updates DynamoDB job status
```

**Stack:** Next.js (frontend + API routes) · AWS Lambda (Node.js 20) · S3 · DynamoDB · Terraform

## Prerequisites

- [Node.js](https://nodejs.org/) 20.x
- [Terraform](https://developer.hashicorp.com/terraform/install) ~> 1.x
- An AWS account with credentials configured (`aws configure`, or an access key/secret)
- The [AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html) (optional, handy for checking things after deploy)

## 1. Deploy the infrastructure

This provisions both S3 buckets, the DynamoDB table, the Lambda function, and IAM roles — and zips up `lambda/` automatically.

```bash
cd infra
terraform init
terraform apply
```

Note the outputs — you'll need them for the frontend's `.env.local`:

```
raw_bucket_name       = "<project>-raw-uploads-2026"
processed_bucket_name = "<project>-processed-files-2026"
dynamodb_table_name   = "<project>-job-status"
```

> **Sharp on Lambda:** Lambda runs on Linux x64. If you're developing on Windows/macOS and change `lambda/` code, reinstall Sharp for the target platform before re-deploying, so the correct native binary ends up in the zip:
> ```bash
> cd lambda
> npm install --platform=linux --arch=x64 sharp
> ```

## 2. Configure and run the frontend

```bash
cd frontend
npm install
```

Create `frontend/.env.local`:

```env
AWS_REGION=ap-south-1
AWS_ACCESS_KEY_ID=your-access-key-id
AWS_SECRET_ACCESS_KEY=your-secret-access-key
RAW_BUCKET=<raw_bucket_name from terraform output>
PROCESSED_BUCKET=<processed_bucket_name from terraform output>
DYNAMODB_TABLE=<dynamodb_table_name from terraform output>
```

Then start the dev server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

> The S3 CORS config (`infra/s3.tf`) only allows uploads from `http://localhost:3000` by default — update `allowed_origins` and re-apply Terraform if you deploy the frontend elsewhere.

## Usage

1. Open the app and drag an image into the upload area (or click to browse).
2. Click **Upload & process**. The file uploads straight to S3.
3. The UI shows a Job ID and polls its status while Lambda processes the image.
4. Once done, click **Download processed image** to get the compressed, watermarked result.

## Tearing it down

```bash
cd infra
terraform destroy
```

This deletes the Lambda, IAM roles, DynamoDB table, and both S3 buckets (buckets must be empty first — see below).

To empty the buckets manually:

```bash
aws s3 rm s3://<raw-bucket-name> --recursive
aws s3 rm s3://<processed-bucket-name> --recursive
```

## Project structure

```
infra/      Terraform config (S3, DynamoDB, Lambda, IAM)
lambda/     Lambda function source (image processing with Sharp)
frontend/   Next.js app (upload UI + API routes for presigned URLs & status)
```
