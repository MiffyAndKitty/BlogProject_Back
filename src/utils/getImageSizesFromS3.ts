import { s3 } from '../config/s3';
import { HeadObjectCommand } from '@aws-sdk/client-s3';

export async function getImageSizesFromS3(
  draftContent: string
): Promise<{ sizes: { [url: string]: number | null }; totalSize: number }> {
  const imageUrls = extractImageUrls(draftContent);

  const sizePromises = imageUrls.map(async (url) => {
    if (isS3Url(url)) {
      const { Bucket, Key } = parseS3Url(url);
      try {
        const command = new HeadObjectCommand({ Bucket, Key });
        const headResult = await s3.send(command);
        const contentLength = headResult.ContentLength ?? null; // undefined를 null로 변환
        return { url, size: contentLength };
      } catch (error) {
        console.error(`Failed to get size for ${url}:`, error);
        return { url, size: null };
      }
    } else {
      // S3 URL이 아닌 경우
      return { url, size: null };
    }
  });

  const sizesArray = await Promise.all(sizePromises);

  const sizes: { [url: string]: number | null } = {};
  let totalSize = 0;

  sizesArray.forEach(({ url, size }) => {
    sizes[url] = size;
    if (size !== null) {
      totalSize += size;
    }
  });

  return { sizes, totalSize };
}

function extractImageUrls(content: string): string[] {
  const regex = /<img[^>]+src="([^">]+)"/g;
  const urls: string[] = [];
  let match;
  while ((match = regex.exec(content)) !== null) {
    urls.push(match[1]);
  }
  return urls;
}

function isS3Url(url: string): boolean {
  return url.includes('.s3.');
}

function parseS3Url(url: string): { Bucket: string; Key: string } {
  const parsedUrl = new URL(url);
  const hostParts = parsedUrl.hostname.split('.');
  const Bucket = hostParts[0];
  const Key = decodeURIComponent(parsedUrl.pathname.substring(1));
  return { Bucket, Key };
}
