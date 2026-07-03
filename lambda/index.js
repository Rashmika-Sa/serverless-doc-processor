const { S3Client, GetObjectCommand, PutObjectCommand } = require("@aws-sdk/client-s3");
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, PutCommand, UpdateCommand } = require("@aws-sdk/lib-dynamodb");
const sharp = require("sharp");

const s3 = new S3Client({});
const ddbClient = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(ddbClient);

const DYNAMODB_TABLE = process.env.DYNAMODB_TABLE;
const PROCESSED_BUCKET = process.env.PROCESSED_BUCKET;

exports.handler = async (event) => {
  const record = event.Records[0];
  const sourceBucket = record.s3.bucket.name;
  const objectKey = decodeURIComponent(record.s3.object.key.replace(/\+/g, " "));
  const jobId = objectKey;

  console.log(`Processing ${objectKey} from ${sourceBucket}`);

  try {
    // Step 1: mark the job as "processing" in DynamoDB
    await ddb.send(new PutCommand({
      TableName: DYNAMODB_TABLE,
      Item: {
        job_id: jobId,
        status: "processing",
        created_at: new Date().toISOString(),
      },
    }));

    // Step 2: download the original image from S3
    const original = await s3.send(new GetObjectCommand({
      Bucket: sourceBucket,
      Key: objectKey,
    }));
    const imageBuffer = Buffer.concat(await original.Body.toArray());

    // Step 3: get image dimensions so we can size the watermark correctly
    const metadata = await sharp(imageBuffer).metadata();
    const watermarkText = "RRS";
    const fontSize = Math.max(24, Math.floor(metadata.width * 0.05));

    const watermarkSvg = `
      <svg width="${metadata.width}" height="${metadata.height}">
        <text
          x="${metadata.width - 20}"
          y="${metadata.height - 20}"
          font-family="Arial, sans-serif"
          font-size="${fontSize}"
          font-weight="bold"
          fill="white"
          fill-opacity="0.6"
          text-anchor="end"
        >${watermarkText}</text>
      </svg>
    `;

    // Step 4: compress + watermark in one pipeline
    const processedBuffer = await sharp(imageBuffer)
      .resize({ width: 1600, withoutEnlargement: true })
      .composite([{ input: Buffer.from(watermarkSvg), gravity: "southeast" }])
      .jpeg({ quality: 70 })
      .toBuffer();

    // Step 5: upload the result to the processed bucket
    const outputKey = `processed-${objectKey.replace(/\.[^.]+$/, "")}.jpg`;
    await s3.send(new PutObjectCommand({
      Bucket: PROCESSED_BUCKET,
      Key: outputKey,
      Body: Buffer.concat([processedBuffer]),
      ContentType: "image/jpeg",
    }));

    // Step 6: mark the job as "done"
    await ddb.send(new UpdateCommand({
      TableName: DYNAMODB_TABLE,
      Key: { job_id: jobId },
      UpdateExpression: "SET #s = :status, processed_key = :key, completed_at = :time",
      ExpressionAttributeNames: { "#s": "status" },
      ExpressionAttributeValues: {
        ":status": "done",
        ":key": outputKey,
        ":time": new Date().toISOString(),
      },
    }));

    console.log(`Done. Output saved as ${outputKey}`);
    return { statusCode: 200, body: `Processed ${outputKey}` };

  } catch (err) {
    console.error("Processing failed:", err);

    // mark job as failed so the frontend can show an error instead of hanging forever
    await ddb.send(new UpdateCommand({
      TableName: DYNAMODB_TABLE,
      Key: { job_id: jobId },
      UpdateExpression: "SET #s = :status, error_message = :err",
      ExpressionAttributeNames: { "#s": "status" },
      ExpressionAttributeValues: {
        ":status": "failed",
        ":err": err.message,
      },
    }));

    throw err;
  }
};