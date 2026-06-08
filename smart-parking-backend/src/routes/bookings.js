const express = require("express");
const db = require("../db");
const { authRequired } = require("../middleware/auth");
const router = express.Router();
router.use(authRequired);
router.get("/", async (req, res) => {
  const result = await db.query("SELECT b.*, v.emirate, v.plate_code, v.plate_color, v.plate_number FROM bookings b LEFT JOIN vehicles v ON v.id=b.vehicle_id WHERE b.user_id=$1 ORDER BY b.id DESC", [req.user.id]);
  res.json({ bookings: result.rows });
});
router.post("/", async (req, res) => {
  const { parkingName, parkingAddress, vehicleId, durationHours, amountAed } = req.body;
  if (!parkingName) return res.status(400).json({ message: "Parking name is required" });
  const result = await db.query("INSERT INTO bookings (user_id, parking_name, parking_address, vehicle_id, duration_hours, amount_aed) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *", [req.user.id, parkingName, parkingAddress || null, vehicleId || null, durationHours || 1, amountAed || 0]);
  res.status(201).json({ booking: result.rows[0] });
});
module.exports = router;
