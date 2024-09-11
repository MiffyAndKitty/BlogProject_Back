export const stripHtmlTags = (value: string): string => {
  return value.replace(/<\/?[^>]+(>|$)/g, '').trim();
};
