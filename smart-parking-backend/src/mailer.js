const nodemailer = require("nodemailer");
require("dotenv").config();
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: Number(process.env.SMTP_PORT || 465),
  secure: true,
  family: 4,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
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
