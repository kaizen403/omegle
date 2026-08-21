import {
  DeleteObjectCommand,
  DeleteObjectsCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { config } from '../../config';
import { logger } from '../../utils/logger';

class S3StorageService {
  private client: S3Client | null = null;

  private getClient(): S3Client {
    if (!config.s3Bucket || !config.awsRegion) {
      throw new Error('S3 is not configured. Set S3_BUCKET and AWS_REGION.');
    }

    if (!this.client) {
      this.client = new S3Client({ region: config.awsRegion });
    }

    return this.client;
  }

  private publicUrl(key: string): string {
    if (config.s3PublicBaseUrl) {
      return `${config.s3PublicBaseUrl.replace(/\/$/, '')}/${key}`;
    }
    return `https://${config.s3Bucket}.s3.${config.awsRegion}.amazonaws.com/${key}`;
  }

  async uploadFile(
    path: string,
    buffer: Buffer,
    mimeType: string,
    _metadata?: Record<string, string>
  ): Promise<string> {
    const client = this.getClient();
    await client.send(
      new PutObjectCommand({
        Bucket: config.s3Bucket,
        Key: path,
        Body: buffer,
        ContentType: mimeType,
      })
    );
    logger.info(`Uploaded s3://${config.s3Bucket}/${path}`);
    return this.publicUrl(path);
  }

  async deleteFile(path: string): Promise<void> {
    const client = this.getClient();
    await client.send(
      new DeleteObjectCommand({
        Bucket: config.s3Bucket,
        Key: path,
      })
    );
    logger.info(`Deleted s3://${config.s3Bucket}/${path}`);
  }

  async deleteFolder(folderPath: string): Promise<void> {
    const client = this.getClient();
    const prefix = folderPath.endsWith('/') ? folderPath : `${folderPath}/`;
    let continuationToken: string | undefined;

    do {
      const listed = await client.send(
        new ListObjectsV2Command({
          Bucket: config.s3Bucket,
          Prefix: prefix,
          ContinuationToken: continuationToken,
        })
      );

      const objects = (listed.Contents || [])
        .map((item) => item.Key)
        .filter((key): key is string => Boolean(key))
        .map((Key) => ({ Key }));

      if (objects.length > 0) {
        await client.send(
          new DeleteObjectsCommand({
            Bucket: config.s3Bucket,
            Delete: { Objects: objects, Quiet: true },
          })
        );
      }

      continuationToken = listed.IsTruncated ? listed.NextContinuationToken : undefined;
    } while (continuationToken);
  }
}

export const storageService = new S3StorageService();
export default storageService;
