import { NextRequest, NextResponse } from "next/server";
import { GetCommand } from "@aws-sdk/lib-dynamodb";
import { ddb, DYNAMODB_TABLE } from "@/lib/aws";

export async function GET(req: NextRequest) {
  const jobId = req.nextUrl.searchParams.get("jobId");

  if (!jobId) {
    return NextResponse.json({ error: "jobId is required" }, { status: 400 });
  }

  const result = await ddb.send(new GetCommand({
    TableName: DYNAMODB_TABLE,
    Key: { job_id: jobId },
  }));

  if (!result.Item) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  return NextResponse.json(result.Item);
}