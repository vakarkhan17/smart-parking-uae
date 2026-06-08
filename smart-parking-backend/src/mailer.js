const nodemailer = require("nodemailer");
require("dotenv").config();
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: String(process.env.SMTP_SECURE).toLowerCase() === "true",
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
});
async function sendVerificationEmail(to, code) {
  const appName = process.env.APP_NAME || "Smart UAE Parking";
  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to,
    subject: `${appName} - Email Verification Code`,
    html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:20px;border:1px solid #eee;border-radius:12px"><h2 style="color:#00732f">${appName}</h2><p>Thank you for registering.</p><p>Your email verification code is:</p><div style="font-size:32px;font-weight:bold;letter-spacing:6px;color:#CE1126;margin:20px 0">${code}</div><p>This code will expire in 10 minutes.</p></div>`,
  });
}
module.exports = { sendVerificationEmail };
