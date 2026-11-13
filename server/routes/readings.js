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

// Checks value, date and slot. Returns an error message, or null if all good.
function validateReading({ reading_date, slot, value }) {
  if (value === undefined || value === null || value === '') {
    return { status: 400, error: 'Please enter a glucose value.' };
  }
  const num = Number(value);
  if (!Number.isInteger(num) || num < 40 || num > 600) {
    return { status: 400, error: 'Value must be between 40 and 600 mg/dl.' };
  }
  if (!reading_date || !isRealDate(reading_date)) {
    return { status: 400, error: 'Please choose a valid date.' };
  }
  if (reading_date > todayString()) {
    return { status: 400, error: 'Date cannot be in the future.' };
  }
  if (!SLOT_LABELS[slot]) {
    return { status: 400, error: 'Please choose a valid time slot.' };
  }
  return null;
}

// Add a reading
router.post('/', requireAuth, async (req, res) => {
  const { reading_date, slot, value } = req.body;

  const problem = validateReading({ reading_date, slot, value });
  if (problem) return res.status(problem.status).json({ error: problem.error });

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
      [req.userId, reading_date, slot, Number(value)]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong.' });
  }
});

// View readings (only the logged-in user's). Optional filter: ?date=YYYY-MM-DD
router.get('/', requireAuth, async (req, res) => {
  const { date } = req.query;

  if (date && !isRealDate(date)) {
    return res.status(400).json({ error: 'Please choose a valid date.' });
  }

  try {
    const params = [req.userId];
    let sql = `SELECT id, reading_date::text AS reading_date, slot, value
               FROM readings WHERE user_id = $1`;
    if (date) {
      params.push(date);
      sql += ' AND reading_date = $2';
    }
    sql += ' ORDER BY reading_date DESC, id ASC';

    const result = await pool.query(sql, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong.' });
  }
});

// Edit a reading
router.put('/:id', requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: 'Invalid reading id.' });
  }

  const { reading_date, slot, value } = req.body;

  const problem = validateReading({ reading_date, slot, value });
  if (problem) return res.status(problem.status).json({ error: problem.error });

  try {
    const existing = await pool.query(
      'SELECT id, reading_date::text AS reading_date FROM readings WHERE id = $1 AND user_id = $2',
      [id, req.userId]
    );
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Reading not found.' });
    }

    // Moving to a different day? Then that day must have room.
    if (existing.rows[0].reading_date !== reading_date) {
      const count = await pool.query(
        'SELECT COUNT(*) FROM readings WHERE user_id = $1 AND reading_date = $2',
        [req.userId, reading_date]
      );
      if (Number(count.rows[0].count) >= 4) {
        return res.status(400).json({ error: 'You can add only 4 readings per day.' });
      }
    }

    // Same slot on the same day, ignoring this reading itself
    const dup = await pool.query(
      `SELECT id FROM readings
       WHERE user_id = $1 AND reading_date = $2 AND slot = $3 AND id <> $4`,
      [req.userId, reading_date, slot, id]
    );
    if (dup.rows.length > 0) {
      return res.status(409).json({
        error: `You already have an ${SLOT_LABELS[slot]} reading for this date.`,
      });
    }

    const result = await pool.query(
      `UPDATE readings SET reading_date = $1, slot = $2, value = $3
       WHERE id = $4 AND user_id = $5
       RETURNING id, reading_date::text AS reading_date, slot, value`,
      [reading_date, slot, Number(value), id, req.userId]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong.' });
  }
});

// Delete a reading
router.delete('/:id', requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: 'Invalid reading id.' });
  }

  try {
    const result = await pool.query(
      'DELETE FROM readings WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, req.userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Reading not found.' });
    }
    res.json({ message: 'Reading deleted.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong.' });
  }
});

module.exports = router;