const express = require("express");
const db = require("../db");
const { authRequired } = require("../middleware/auth");
const router = express.Router();
router.get("/me", authRequired, async (req, res) => {
  const result = await db.query("SELECT id, full_name, email, is_email_verified, created_at FROM users WHERE id=$1", [req.user.id]);
  if (result.rows.length === 0) return res.status(404).json({ message: "User not found" });
  res.json({ user: result.rows[0] });
});
module.exports = router;
