const express = require('express');
const pool = require('../db');
const requireAuth = require('../middleware/auth');

const router = express.Router();

const SLOT_LABELS = {
  morning: 'Morning (fasting)',
  after_breakfast: 'After breakfast',
  after_lunch: 'After lunch',
  after_dinner: 'After dinner',
};

function todayString() {
  const d = new Date();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
}

function isRealDate(str) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(str)) return false;
  const d = new Date(str + 'T00:00:00Z');
  return !isNaN(d) && d.toISOString().slice(0, 10) === str;
}

// Add a reading
router.post('/', requireAuth, async (req, res) => {
  const { reading_date, slot, value } = req.body;

  if (value === undefined || value === null || value === '') {
    return res.status(400).json({ error: 'Please enter a glucose value.' });
  }
  const num = Number(value);
  if (!Number.isInteger(num) || num < 40 || num > 600) {
    return res.status(400).json({ error: 'Value must be between 40 and 600 mg/dl.' });
  }
  if (!reading_date || !isRealDate(reading_date)) {
    return res.status(400).json({ error: 'Please choose a valid date.' });
  }
  if (reading_date > todayString()) {
    return res.status(400).json({ error: 'Date cannot be in the future.' });
  }
  if (!SLOT_LABELS[slot]) {
    return res.status(400).json({ error: 'Please choose a valid time slot.' });
  }

  try {
    const count = await pool.query(
      'SELECT COUNT(*) FROM readings WHERE user_id = $1 AND reading_date = $2',
      [req.userId, reading_date]
    );
    if (Number(count.rows[0].count) >= 4) {
      return res.status(400).json({ error: 'You can add only 4 readings per day.' });
    }

    const dup = await pool.query(
      'SELECT id FROM readings WHERE user_id = $1 AND reading_date = $2 AND slot = $3',
      [req.userId, reading_date, slot]
    );
    if (dup.rows.length > 0) {
      return res.status(409).json({
        error: `You already have an ${SLOT_LABELS[slot]} reading for this date.`,
      });
    }

    const result = await pool.query(
      `INSERT INTO readings (user_id, reading_date, slot, value)
       VALUES ($1, $2, $3, $4)
       RETURNING id, reading_date::text AS reading_date, slot, value`,
      [req.userId, reading_date, slot, num]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong.' });
  }
});

module.exports = router;