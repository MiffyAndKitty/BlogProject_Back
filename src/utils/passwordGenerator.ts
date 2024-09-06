import { faker } from '@faker-js/faker';

export const generatePassword = (): string => {
  const lowerCase = faker.string.alpha({ length: 1, casing: 'lower' });
  const number = faker.string.numeric(1);
  const specialChar = faker.helpers.arrayElement([
    '!',
    '@',
    '#',
    '$',
    '%',
    '^',
    '&',
    '*'
  ]);
  const randomChars = faker.string.alphanumeric(5);

  return `${lowerCase}${number}${specialChar}${randomChars}`;
};
