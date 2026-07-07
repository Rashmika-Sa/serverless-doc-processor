import { NextRequest, NextResponse } from "next/server";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { s3, PROCESSED_BUCKET } from "@/lib/aws";

export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get("key");

  if (!key) {
    return NextResponse.json({ error: "key is required" }, { status: 400 });
  }

  const command = new GetObjectCommand({
    Bucket: PROCESSED_BUCKET,
    Key: key,
  });

  const downloadUrl = await getSignedUrl(s3, command, { expiresIn: 300 });

  return NextResponse.json({ downloadUrl });
}