require('dotenv').config();
const bcrypt = require('bcrypt');
const pool = require('./index');

const DEMO = { name: 'Demo User', email: 'demo@sweety.com', password: 'demo1234' };
const SLOTS = ['morning', 'after_breakfast', 'after_lunch', 'after_dinner'];

function formatDate(d) {
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
}

async function seed() {
  try {
    // Remove the old demo user (their readings go too), so the script can be re-run
    await pool.query('DELETE FROM users WHERE email = $1', [DEMO.email]);

    const hash = await bcrypt.hash(DEMO.password, 10);
    const user = await pool.query(
      'INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id',
      [DEMO.name, DEMO.email, hash]
    );
    const userId = user.rows[0].id;

    const today = new Date();
    let inserted = 0;

    // Last 70 days: covers this month and the whole previous month
    for (let i = 0; i < 70; i++) {
      if (i % 9 === 4) continue; // skip a few days, like real life

      const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
      const dateStr = formatDate(d);
      const slotCount = 2 + (i % 3); // 2 to 4 readings per day

      for (let s = 0; s < slotCount; s++) {
        const base = s === 0 ? 100 : 140; // fasting is usually lower
        const value = base + ((i * 7 + s * 13) % 50);
        await pool.query(
          'INSERT INTO readings (user_id, reading_date, slot, value) VALUES ($1, $2, $3, $4)',
          [userId, dateStr, SLOTS[s], value]
        );
        inserted++;
      }
    }

    console.log(`Seeded demo user with ${inserted} readings.`);
    console.log(`Login: ${DEMO.email} / ${DEMO.password}`);
  } catch (err) {
    console.error('Seeding failed:', err.message);
  } finally {
    await pool.end();
  }
}

seed();