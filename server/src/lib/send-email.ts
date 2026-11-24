import nodemailer from "nodemailer";
import sgMail from "@sendgrid/mail";
import type { PgBoss } from "pg-boss";
import Sentry from "./sentry";

const QUEUE_NAME = "send-email";

interface SendEmailJobData {
  to: string;
  subject: string;
  body: string;
  bodyHtml?: string;
}

export async function registerSendEmailWorker(boss: PgBoss): Promise<void> {
  await boss.createQueue(QUEUE_NAME, {
    retryLimit: 3,
    retryDelay: 30,
    retryBackoff: true,
  });

  const gmailTransporter =
    process.env.SMTP_USER && process.env.SMTP_PASS
      ? nodemailer.createTransport({
          service: "gmail",
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
          },
        })
      : null;

  await boss.work<SendEmailJobData>(QUEUE_NAME, async (jobs) => {
    const { to, subject, body, bodyHtml } = jobs[0]!.data;

    try {
      if (gmailTransporter) {
        await gmailTransporter.sendMail({
          from:
            process.env.SMTP_FROM ||
            `"Helpdesk Support" <${process.env.SMTP_USER}>`,
          to,
          subject,
          text: body,
          ...(bodyHtml && { html: bodyHtml }),
        });
        console.log(`[Gmail] Email sent to ${to} — subject: "${subject}"`);
        return;
      }

      if (process.env.SENDGRID_API_KEY && process.env.SENDGRID_FROM_EMAIL) {
        sgMail.setApiKey(process.env.SENDGRID_API_KEY);
        await sgMail.send({
          to,
          from: process.env.SENDGRID_FROM_EMAIL,
          subject,
          text: body,
          ...(bodyHtml && { html: bodyHtml }),
        });
        console.log(`[SendGrid] Email sent to ${to} — subject: "${subject}"`);
        return;
      }

      console.log(`[Dev] Mock email to ${to}: "${subject}"`);
    } catch (error) {
      Sentry.captureException(error, {
        tags: { queue: QUEUE_NAME },
      });
      throw error;
    }
  });
}

export async function sendEmailJob(data: SendEmailJobData): Promise<void> {
  const { boss } = await import("./queue");
  await boss.send(QUEUE_NAME, data);
}
