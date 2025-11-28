import nodemailer from "nodemailer";
import SMTPTransport from "nodemailer/lib/smtp-transport";
import { env } from "../config/env";

export async function sendMail(to: string, subject: string, text: string) {
  if (env.MAIL_PROVIDER === "mailhog") {
    const transporter = nodemailer.createTransport(
      {
        host: env.MAILHOG_HOST,
        port: parseInt(env.MAILHOG_PORT!),
        secure: false,
      } as SMTPTransport.Options // 型キャスト
    );

    await transporter.sendMail({
      from: "noreply@example.com",
      to: to,
      subject: subject,
      html: text,
    });

    console.log(`📨 Mail sent to ${to} (via MailHog)`);
  } else {
    console.log(`✉️ [Mock] Mail to ${to}: ${subject}`);
  }
}
