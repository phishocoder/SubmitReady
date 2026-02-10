import nodemailer from "nodemailer";
import { env, isEmailConfigured } from "@/lib/env";

export async function sendDownloadEmail(params: {
  to: string;
  downloadUrl: string;
}): Promise<void> {
  if (!isEmailConfigured) {
    console.info("[email] SMTP not configured. Download URL:", params.downloadUrl);
    return;
  }

  const transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: Number(env.SMTP_PORT) === 465,
    auth: {
      user: env.SMTP_USER,
      pass: env.SMTP_PASS,
    },
  });

  await transporter.sendMail({
    from: env.SMTP_FROM_EMAIL,
    to: params.to,
    subject: "Your SubmitReady reimbursement PDF is ready",
    text: `Your PDF is ready. Download it using this secure link (expires in 24 hours): ${params.downloadUrl}`,
    html: `<p>Your PDF is ready.</p><p><a href="${params.downloadUrl}">Download your reimbursement PDF</a> (expires in 24 hours).</p>`,
  });
}
