const { S3Client, GetObjectCommand, PutObjectCommand } = require("@aws-sdk/client-s3");
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, PutCommand, UpdateCommand } = require("@aws-sdk/lib-dynamodb");
const sharp = require("sharp");
const path = require("path");

const s3 = new S3Client({});
const ddbClient = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(ddbClient);

const DYNAMODB_TABLE = process.env.DYNAMODB_TABLE;
const PROCESSED_BUCKET = process.env.PROCESSED_BUCKET;

// Pre-rendered "RRS" watermark PNG (generated where fonts are available).
// Lambda's base runtime ships no fonts, so rendering SVG <text> at request
// time produces invisible glyphs — compositing a raster image sidesteps that.
const WATERMARK_PATH = path.join(__dirname, "assets", "watermark.png");

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

    // Step 3: compress first, then size the watermark to match the resized image
    const resizedBuffer = await sharp(imageBuffer)
      .resize({ width: 1600, withoutEnlargement: true })
      .toBuffer();
    const resizedMetadata = await sharp(resizedBuffer).metadata();

    // Step 4: scale the watermark to ~18% of the image width, with a margin
    const margin = 20;
    const watermarkWidth = Math.min(
      Math.max(80, Math.floor(resizedMetadata.width * 0.18)),
      resizedMetadata.width - margin * 2
    );
    const watermarkBuffer = await sharp(WATERMARK_PATH)
      .resize({ width: watermarkWidth })
      .toBuffer();
    const watermarkMetadata = await sharp(watermarkBuffer).metadata();

    // Step 5: watermark + encode
    const processedBuffer = await sharp(resizedBuffer)
      .composite([{
        input: watermarkBuffer,
        left: resizedMetadata.width - watermarkMetadata.width - margin,
        top: resizedMetadata.height - watermarkMetadata.height - margin,
      }])
      .flatten({ background: { r: 255, g: 255, b: 255 } })
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