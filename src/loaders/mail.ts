import nodemailer from 'nodemailer';
import { mailBaseConfig } from '../config/mail';

export const transporter = nodemailer.createTransport(mailBaseConfig);
