import { ensureError } from '../../errors/ensureError';

export const replaceImageUrlsWithS3Links = (
  content: string,
  fileUrls: Array<string>
) => {
  try {
    const pattern = /(<img[^>]*src=['"])([^'"]+)(['"][^>]*>)/g; // p1, p2, p3
    const skipUrlPrefix = `https://${process.env.S3_BUCKET}.s3.${process.env.S3_REGION}.amazonaws.com`;

    let index = 0;
    let replacedContent = content;

    replacedContent = replacedContent.replace(pattern, (match, p1, p2, p3) => {
      if (p2.startsWith(skipUrlPrefix)) {
        return match;
      }
      const imageUrl = fileUrls[index];
      index++;
      return `${p1}${imageUrl}${p3}`;
    });

    return replacedContent;
  } catch (err) {
    throw ensureError(err, '게시글 이미지 URL 수정 중 에러 발생');
  }
};
