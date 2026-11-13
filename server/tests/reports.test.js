require('dotenv').config();
const request = require('supertest');
const app = require('../app');
const pool = require('../db');

const email = `reports-${Date.now()}@sweety.test`;
let token;

function getReport(type, date) {
  return request(app)
    .get(`/reports/${type}?date=${date}`)
    .set('Authorization', `Bearer ${token}`);
}

beforeAll(async () => {
  await request(app)
    .post('/auth/register')
    .send({ name: 'Report Tester', email, password: 'secret123' });
  const login = await request(app).post('/auth/login').send({ email, password: 'secret123' });
  token = login.body.token;

  const user = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
  const userId = user.rows[0].id;

  const readings = [
    ['2026-10-15', 'morning', 100],
    ['2026-10-15', 'after_lunch', 140],
    ['2026-10-03', 'morning', 90],
    ['2026-10-20', 'morning', 300], // after the selected date, must be left out
    ['2026-09-10', 'morning', 110],
    ['2026-09-30', 'after_dinner', 131],
    ['2026-08-31', 'morning', 500], // before September, must be left out
  ];
  for (const [date, slot, value] of readings) {
    await pool.query(
      'INSERT INTO readings (user_id, reading_date, slot, value) VALUES ($1, $2, $3, $4)',
      [userId, date, slot, value]
    );
  }
});

afterAll(async () => {
  await pool.query('DELETE FROM users WHERE email = $1', [email]);
  await pool.end();
});

describe('Reports', () => {
  test('daily report covers the selected date and lists readings with slots', async () => {
    const res = await getReport('daily', '2026-10-15');
    expect(res.status).toBe(200);
    expect(res.body.from).toBe('2026-10-15');
    expect(res.body.to).toBe('2026-10-15');
    expect(res.body.count).toBe(2);
    expect(res.body.highest).toBe(140);
    expect(res.body.lowest).toBe(100);
    expect(res.body.average).toBe(120);
    expect(res.body.readings.map((r) => r.slot)).toEqual(['morning', 'after_lunch']);
  });

  test('month-to-date runs from the 1st to the selected date', async () => {
    const res = await getReport('month-to-date', '2026-10-15');
    expect(res.body.from).toBe('2026-10-01');
    expect(res.body.to).toBe('2026-10-15');
    expect(res.body.count).toBe(3);
    expect(res.body.highest).toBe(140);
    expect(res.body.lowest).toBe(90);
    expect(res.body.average).toBe(110);
  });

  test('monthly report is the whole previous month, average rounded to 1 decimal', async () => {
    const res = await getReport('monthly', '2026-10-15');
    expect(res.body.from).toBe('2026-09-01');
    expect(res.body.to).toBe('2026-09-30');
    expect(res.body.count).toBe(2);
    expect(res.body.highest).toBe(131);
    expect(res.body.lowest).toBe(110);
    expect(res.body.average).toBe(120.5);
  });

  test('a day with no readings gives an empty report', async () => {
    const res = await getReport('daily', '2026-10-01');
    expect(res.body.empty).toBe(true);
    expect(res.body.count).toBe(0);
    expect(res.body.highest).toBeNull();
  });

  test('a future date is rejected', async () => {
    const res = await getReport('daily', '2030-01-01');
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Date cannot be in the future.');
  });
});