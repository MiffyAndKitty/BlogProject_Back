export const stripHtmlTags = (value: string): string => {
  return value.replace(/<(?!img\b[^>]*\bsrc\b)[^>]+>/g, '').trim();
};
