import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { randomUUID } from "node:crypto";
import { AppError } from "shared";

let storageClient: S3Client | undefined;

function getStorageClient() {
  if (storageClient) {
    return storageClient;
  }

  const endpoint = process.env.AWS_ENDPOINT_URL_S3;
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
  const region = process.env.AWS_REGION;

  if (!endpoint || !accessKeyId || !secretAccessKey || !region) {
    const missingKeys = [
      ["AWS_ENDPOINT_URL_S3", endpoint],
      ["AWS_ACCESS_KEY_ID", accessKeyId],
      ["AWS_SECRET_ACCESS_KEY", secretAccessKey],
      ["AWS_REGION", region],
    ]
      .filter(([, value]) => !value)
      .map(([key]) => key);

    throw new AppError(500, "Object storage is not configured", false, {
      code: "CONFIGURATION_MISSING",
      details: { missingKeys },
    });
  }

  let endpointUrl: URL;
  try {
    endpointUrl = new URL(endpoint);
  } catch (cause) {
    throw new AppError(500, "Object storage endpoint is invalid", false, {
      code: "CONFIGURATION_INVALID",
      cause,
      details: { key: "AWS_ENDPOINT_URL_S3" },
    });
  }

  if (endpointUrl.protocol !== "http:" && endpointUrl.protocol !== "https:") {
    throw new AppError(500, "Object storage endpoint must use HTTP or HTTPS", false, {
      code: "CONFIGURATION_INVALID",
      details: { key: "AWS_ENDPOINT_URL_S3" },
    });
  }

  storageClient = new S3Client({
    region,
    endpoint: endpointUrl.toString(),
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: true,
  });

  return storageClient;
}

export function validateStorageConfiguration(): void {
  const bucket = process.env.STORAGE_BUCKET;

  if (!bucket) {
    throw new AppError(500, "Object storage is not configured", false, {
      code: "CONFIGURATION_MISSING",
      details: { key: "STORAGE_BUCKET" },
    });
  }

  getStorageClient();
}

export async function uploadBuffer(
  buffer: Buffer,
  contentType = "image/jpeg",
): Promise<{ imageUrl: string; publicId: string }> {
  const bucket = process.env.STORAGE_BUCKET;
  const endpoint = process.env.AWS_ENDPOINT_URL_S3;

  if (!bucket || !endpoint) {
    const missingKeys = [
      ["STORAGE_BUCKET", bucket],
      ["AWS_ENDPOINT_URL_S3", endpoint],
    ]
      .filter(([, value]) => !value)
      .map(([key]) => key);

    throw new AppError(500, "Object storage is not configured", false, {
      code: "CONFIGURATION_MISSING",
      details: { missingKeys },
    });
  }

  const Key = `support-tasks/${randomUUID()}`;

  try {
    await getStorageClient().send(
      new PutObjectCommand({
        Bucket: bucket,
        Key,
        Body: buffer,
        ContentType: contentType,
      }),
    );
  } catch (cause) {
    if (cause instanceof AppError) {
      throw cause;
    }

    throw new AppError(502, "Object storage upload failed", true, {
      code: "OBJECT_STORAGE_UPLOAD_FAILED",
      cause,
      details: { operation: "put_object", resource: "attachment" },
    });
  }

  const baseUrl = endpoint.endsWith("/") ? endpoint.slice(0, -1) : endpoint;

  return {
    publicId: Key,
    imageUrl: `${baseUrl}/${bucket}/${Key}`,
  };
}
