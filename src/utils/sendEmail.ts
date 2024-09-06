import '../config/env';
import { transporter } from '../loaders/mail';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { ensureError } from '../errors/ensureError';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 템플릿에서 데이터를 치환하는 함수
const replaceTemplateVariables = (
  template: string,
  variables: { [key: string]: string }
): string => {
  let content = template;
  for (const [key, value] of Object.entries(variables)) {
    content = content.replace(new RegExp(`{{${key}}}`, 'g'), value);
  }
  return content;
};

// 이메일 전송 함수
export const sendEMail = async (
  receiverEmail: string,
  subject: string,
  templateName: string, // 템플릿 파일 이름
  variables: { [key: string]: string } // 템플릿에 치환할 변수들
): Promise<boolean> => {
  try {
    const templatePath = path.join(
      __dirname,
      `../templates/${templateName}.html`
    );

    // 템플릿 파일 읽기
    let emailContent = fs.readFileSync(templatePath, 'utf-8');

    // 템플릿 내 변수를 실제 데이터로 치환
    emailContent = replaceTemplateVariables(emailContent, variables);

    const sentResult = await transporter.sendMail({
      from: process.env.MAILSENDER_EMAIL,
      to: receiverEmail,
      subject,
      html: emailContent
    });

    // 이메일이 성공적으로 전송되었는지 확인
    return sentResult.accepted.length > 0;
  } catch (err) {
    const error = ensureError(err);
    console.log(error.message);
    return false;
  }
};
