const express = require('express');
const pool = require('../db');
const requireAuth = require('../middleware/auth');

const router = express.Router();

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

function pad(n) {
  return String(n).padStart(2, '0');
}

// Reads ?date=YYYY-MM-DD (defaults to today). Sends an error and returns null if bad.
function getSelectedDate(req, res) {
  const date = req.query.date || todayString();
  if (!isRealDate(date)) {
    res.status(400).json({ error: 'Please choose a valid date.' });
    return null;
  }
  if (date > todayString()) {
    res.status(400).json({ error: 'Date cannot be in the future.' });
    return null;
  }
  return date;
}

// Highest, lowest, average (1 decimal) and count between two dates
async function getStats(userId, from, to) {
  const result = await pool.query(
    `SELECT MAX(value) AS highest,
            MIN(value) AS lowest,
            ROUND(AVG(value), 1) AS average,
            COUNT(*) AS count
     FROM readings
     WHERE user_id = $1 AND reading_date BETWEEN $2 AND $3`,
    [userId, from, to]
  );
  const row = result.rows[0];
  const count = Number(row.count);

  if (count === 0) {
    return { from, to, count: 0, highest: null, lowest: null, average: null, empty: true };
  }
  return {
    from,
    to,
    count,
    highest: row.highest,
    lowest: row.lowest,
    average: Number(row.average),
    empty: false,
  };
}

// Daily report: the selected date, plus each reading with its slot
router.get('/daily', requireAuth, async (req, res) => {
  const date = getSelectedDate(req, res);
  if (!date) return;

  try {
    const stats = await getStats(req.userId, date, date);
    const list = await pool.query(
      `SELECT id, slot, value FROM readings
       WHERE user_id = $1 AND reading_date = $2
       ORDER BY CASE slot
         WHEN 'morning' THEN 1
         WHEN 'after_breakfast' THEN 2
         WHEN 'after_lunch' THEN 3
         ELSE 4 END`,
      [req.userId, date]
    );
    res.json({ ...stats, readings: list.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong.' });
  }
});

// Month-to-date: 1st of the selected month up to the selected date
router.get('/month-to-date', requireAuth, async (req, res) => {
  const date = getSelectedDate(req, res);
  if (!date) return;

  try {
    const from = date.slice(0, 7) + '-01';
    res.json(await getStats(req.userId, from, date));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong.' });
  }
});

// Monthly: the whole month before the selected date's month
router.get('/monthly', requireAuth, async (req, res) => {
  const date = getSelectedDate(req, res);
  if (!date) return;

  try {
    let year = Number(date.slice(0, 4));
    let month = Number(date.slice(5, 7)) - 1;
    if (month === 0) {
      month = 12;
      year -= 1;
    }
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const from = `${year}-${pad(month)}-01`;
    const to = `${year}-${pad(month)}-${pad(lastDay)}`;

    res.json(await getStats(req.userId, from, to));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong.' });
  }
});

module.exports = router;