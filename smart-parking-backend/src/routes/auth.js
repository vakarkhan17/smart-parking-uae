const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("../db");
const { sendVerificationEmail } = require("../mailer");
const router = express.Router();
function generateCode() { return String(Math.floor(100000 + Math.random() * 900000)); }
function signToken(user) { return jwt.sign({ id: user.id, email: user.email, fullName: user.full_name }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }); }
router.post("/register", async (req, res) => {
  try {
    const { fullName, email, password } = req.body;
    if (!fullName || !email || !password) return res.status(400).json({ message: "Full name, email and password are required" });
    if (password.length < 6) return res.status(400).json({ message: "Password must be at least 6 characters" });
    const existing = await db.query("SELECT id FROM users WHERE email = $1", [email.toLowerCase()]);
    if (existing.rows.length > 0) return res.status(409).json({ message: "Email already registered" });
    const passwordHash = await bcrypt.hash(password, 12);
    const code = generateCode();
    const expires = new Date(Date.now() + 10 * 60 * 1000);
    const result = await db.query("INSERT INTO users (full_name, email, password_hash, email_verification_code, email_verification_expires) VALUES ($1,$2,$3,$4,$5) RETURNING id, full_name, email, is_email_verified", [fullName, email.toLowerCase(), passwordHash, code, expires]);
    try {
  await sendVerificationEmail(email, code);
} catch (mailError) {
  console.error("Email send failed:", mailError.message);
}
    return res.status(201).json({ message: "Registration successful. Please verify your email.", user: result.rows[0] });
  } catch (error) { console.error(error); return res.status(500).json({ message: "Registration failed" }); }
});
router.post("/verify-email", async (req, res) => {
  try {
    const { email, code } = req.body;
    if (!email || !code) return res.status(400).json({ message: "Email and verification code are required" });
    const result = await db.query("SELECT id, full_name, email, is_email_verified, email_verification_code, email_verification_expires FROM users WHERE email = $1", [email.toLowerCase()]);
    if (result.rows.length === 0) return res.status(404).json({ message: "User not found" });
    const user = result.rows[0];
    if (user.is_email_verified) return res.json({ message: "Email already verified", token: signToken(user) });
    if (user.email_verification_code !== code) return res.status(400).json({ message: "Invalid verification code" });
    if (new Date(user.email_verification_expires) < new Date()) return res.status(400).json({ message: "Verification code expired" });
    const updated = await db.query("UPDATE users SET is_email_verified=TRUE, email_verification_code=NULL, email_verification_expires=NULL, updated_at=CURRENT_TIMESTAMP WHERE id=$1 RETURNING id, full_name, email, is_email_verified", [user.id]);
    return res.json({ message: "Email verified successfully", token: signToken(updated.rows[0]), user: updated.rows[0] });
  } catch (error) { console.error(error); return res.status(500).json({ message: "Email verification failed" }); }
});
router.post("/resend-code", async (req, res) => {
  try {
    const { email } = req.body;
    const result = await db.query("SELECT id, email, is_email_verified FROM users WHERE email=$1", [email.toLowerCase()]);
    if (result.rows.length === 0) return res.status(404).json({ message: "User not found" });
    if (result.rows[0].is_email_verified) return res.status(400).json({ message: "Email already verified" });
    const code = generateCode();
    const expires = new Date(Date.now() + 10 * 60 * 1000);
    await db.query("UPDATE users SET email_verification_code=$1, email_verification_expires=$2 WHERE email=$3", [code, expires, email.toLowerCase()]);
    await sendVerificationEmail(email.toLowerCase(), code);
    return res.json({ message: "Verification code resent" });
  } catch (error) { console.error(error); return res.status(500).json({ message: "Failed to resend verification code" }); }
});
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const result = await db.query("SELECT id, full_name, email, password_hash, is_email_verified FROM users WHERE email=$1", [email.toLowerCase()]);
    if (result.rows.length === 0) return res.status(401).json({ message: "Invalid email or password" });
    const user = result.rows[0];
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ message: "Invalid email or password" });
    if (!user.is_email_verified) return res.status(403).json({ message: "Please verify your email before login" });
    return res.json({ message: "Login successful", token: signToken(user), user: { id: user.id, fullName: user.full_name, email: user.email, isEmailVerified: user.is_email_verified } });
  } catch (error) { console.error(error); return res.status(500).json({ message: "Login failed" }); }
});
module.exports = router;
