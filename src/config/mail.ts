import '../config/env';

export const mailBaseConfig = {
  service: process.env.MAILSENDER_SERVER,
  auth: {
    user: process.env.MAILSENDER_EMAIL,
    pass: process.env.MAILSENDER_PASSWORD
  }
};
