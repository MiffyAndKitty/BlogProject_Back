import { faker } from '@faker-js/faker';

export const generateSixDigitNumber = (): number => {
  return parseInt(faker.string.numeric(6), 10);
};
