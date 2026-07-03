
exports.handler = async (event) => {
  console.log("Event received:", JSON.stringify(event, null, 2));

  const record = event.Records[0];
  const bucketName = record.s3.bucket.name;
  const objectKey = decodeURIComponent(record.s3.object.key.replace(/\+/g, " "));

  console.log(`New file uploaded: ${objectKey} in bucket ${bucketName}`);

  return {
    statusCode: 200,
    body: `Processed ${objectKey}`,
  };
};