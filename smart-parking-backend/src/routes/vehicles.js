const express = require("express");
const db = require("../db");
const { authRequired } = require("../middleware/auth");
const router = express.Router();
router.use(authRequired);
router.get("/", async (req, res) => {
  const result = await db.query("SELECT * FROM vehicles WHERE user_id=$1 ORDER BY is_default DESC, id DESC", [req.user.id]);
  res.json({ vehicles: result.rows });
});
router.post("/", async (req, res) => {
  const { emirate, plateCode, plateColor, plateNumber, isDefault } = req.body;
  if (!emirate || !plateNumber) return res.status(400).json({ message: "Emirate and plate number are required" });
  if (isDefault) await db.query("UPDATE vehicles SET is_default=FALSE WHERE user_id=$1", [req.user.id]);
  const result = await db.query("INSERT INTO vehicles (user_id, emirate, plate_code, plate_color, plate_number, is_default) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *", [req.user.id, emirate, plateCode || null, plateColor || null, plateNumber, Boolean(isDefault)]);
  res.status(201).json({ vehicle: result.rows[0] });
});
router.put("/:id", async (req, res) => {
  const { emirate, plateCode, plateColor, plateNumber, isDefault } = req.body;
  if (isDefault) await db.query("UPDATE vehicles SET is_default=FALSE WHERE user_id=$1", [req.user.id]);
  const result = await db.query("UPDATE vehicles SET emirate=$1, plate_code=$2, plate_color=$3, plate_number=$4, is_default=$5 WHERE id=$6 AND user_id=$7 RETURNING *", [emirate, plateCode || null, plateColor || null, plateNumber, Boolean(isDefault), req.params.id, req.user.id]);
  if (result.rows.length === 0) return res.status(404).json({ message: "Vehicle not found" });
  res.json({ vehicle: result.rows[0] });
});
router.delete("/:id", async (req, res) => {
  const result = await db.query("DELETE FROM vehicles WHERE id=$1 AND user_id=$2 RETURNING id", [req.params.id, req.user.id]);
  if (result.rows.length === 0) return res.status(404).json({ message: "Vehicle not found" });
  res.json({ message: "Vehicle deleted" });
});
module.exports = router;
