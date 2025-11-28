import nodemailer from "nodemailer";
import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";
import dotenv from "dotenv";

dotenv.config();

export async function sendMail(to: string, subject: string, body: string) {
  if (process.env.MAIL_PROVIDER === "mailhog") {
    const transporter = nodemailer.createTransport({
      host: process.env.MAILHOG_HOST,
      port: Number(process.env.MAILHOG_PORT),
    });
    await transporter.sendMail({
      from: "no-reply@example.com",
      to,
      subject,
      text: body,
    });
    console.log(`📨 Mock mail sent to ${to}`);
  } else {
    const ses = new SESClient({ region: process.env.AWS_REGION });
    const command = new SendEmailCommand({
      Source: "no-reply@example.com",
      Destination: { ToAddresses: [to] },
      Message: {
        Subject: { Data: subject },
        Body: { Text: { Data: body } },
      },
    });
    await ses.send(command);
    console.log(`✅ SES mail sent to ${to}`);
  }
}
