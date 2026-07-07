import { NextRequest, NextResponse } from "next/server";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { s3, ddb, RAW_BUCKET, DYNAMODB_TABLE } from "@/lib/aws";
import { PutCommand } from "@aws-sdk/lib-dynamodb";
import { randomUUID } from "crypto";

export async function POST(req: NextRequest) {
  const { fileName, fileType } = await req.json();

  if (!fileName || !fileType) {
    return NextResponse.json({ error: "fileName and fileType are required" }, { status: 400 });
  }

  const jobId = randomUUID();
  const objectKey = `${jobId}-${fileName}`;

  const command = new PutObjectCommand({
    Bucket: RAW_BUCKET,
    Key: objectKey,
    ContentType: fileType,
  });

  const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 300 });

  await ddb.send(new PutCommand({
    TableName: DYNAMODB_TABLE,
    Item: {
      job_id: objectKey,
      status: "awaiting_upload",
      created_at: new Date().toISOString(),
    },
  }));

  return NextResponse.json({ uploadUrl, jobId: objectKey });
}