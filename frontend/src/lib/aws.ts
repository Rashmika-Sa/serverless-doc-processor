import { S3Client } from "@aws-sdk/client-s3";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

export const s3 = new S3Client({ region: process.env.AWS_REGION });

const ddbClient = new DynamoDBClient({ region: process.env.AWS_REGION });
export const ddb = DynamoDBDocumentClient.from(ddbClient);

export const RAW_BUCKET = process.env.RAW_BUCKET!;
export const PROCESSED_BUCKET = process.env.PROCESSED_BUCKET!;
export const DYNAMODB_TABLE = process.env.DYNAMODB_TABLE!;