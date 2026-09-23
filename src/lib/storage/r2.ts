import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
const accessKeyId = process.env.R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
const bucketName = process.env.R2_BUCKET_NAME || 'synapse-vault-media';

export function getR2Client(): S3Client {
  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error('Cloudflare R2 environment credentials are unconfigured.');
  }

  return new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });
}

/**
 * Generates an expiring presigned PUT URL for direct client-to-storage binary streaming.
 */
export async function generatePresignedUploadUrl(
  key: string,
  contentType: string,
  expiresInSeconds: number = 900
): Promise<{ uploadUrl: string; fileKey: string }> {
  const client = getR2Client();

  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: key,
    ContentType: contentType,
  });

  const uploadUrl = await getSignedUrl(client, command, { expiresIn: expiresInSeconds });

  return { uploadUrl, fileKey: key };
}

/**
 * Downloads a stored file stream from R2 as an ArrayBuffer.
 */
export async function downloadFileAsBuffer(key: string): Promise<ArrayBuffer> {
  const client = getR2Client();

  const command = new GetObjectCommand({
    Bucket: bucketName,
    Key: key,
  });

  const response = await client.send(command);

  if (!response.Body) {
    throw new Error(`File payload for key "${key}" returned null body.`);
  }

  const byteArray = await response.Body.transformToByteArray();
  const buffer = new ArrayBuffer(byteArray.byteLength);
  new Uint8Array(buffer).set(byteArray);
  return buffer;
}
