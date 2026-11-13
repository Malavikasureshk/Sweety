require('dotenv').config();
const request = require('supertest');
const app = require('../app');
const pool = require('../db');

const email = `test-${Date.now()}@sweety.test`;
const otherEmail = `other-${Date.now()}@sweety.test`;
let token;
let otherToken;

// Date string like 2026-11-13, a number of days before (negative) or after (positive) today
function dateString(daysFromToday) {
  const d = new Date();
  d.setDate(d.getDate() + daysFromToday);
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
}

async function signUpAndLogin(userEmail) {
  await request(app)
    .post('/auth/register')
    .send({ name: 'Test User', email: userEmail, password: 'secret123' });
  const res = await request(app)
    .post('/auth/login')
    .send({ email: userEmail, password: 'secret123' });
  return res.body.token;
}

function addReading(authToken, body) {
  return request(app)
    .post('/readings')
    .set('Authorization', `Bearer ${authToken}`)
    .send(body);
}

beforeAll(async () => {
  token = await signUpAndLogin(email);
  otherToken = await signUpAndLogin(otherEmail);
});

afterAll(async () => {
  // Deleting the users also deletes their readings
  await pool.query('DELETE FROM users WHERE email = ANY($1)', [[email, otherEmail]]);
  await pool.end();
});

describe('Auth', () => {
  test('password is stored hashed, not as plain text', async () => {
    const result = await pool.query('SELECT password_hash FROM users WHERE email = $1', [email]);
    expect(result.rows[0].password_hash).not.toBe('secret123');
    expect(result.rows[0].password_hash.length).toBeGreaterThan(20);
  });

  test('login fails with a wrong password', async () => {
    const res = await request(app).post('/auth/login').send({ email, password: 'wrongpass' });
    expect(res.status).toBe(401);
  });
});

describe('Reading validation', () => {
  test('value is required', async () => {
    const res = await addReading(token, { reading_date: dateString(-1), slot: 'morning' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Please enter a glucose value.');
  });

  test.each([39, 601, 100.5])('value %p is rejected', async (value) => {
    const res = await addReading(token, { reading_date: dateString(-1), slot: 'morning', value });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Value must be between 40 and 600 mg/dl.');
  });

  test('future date is rejected', async () => {
    const res = await addReading(token, { reading_date: dateString(1), slot: 'morning', value: 100 });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Date cannot be in the future.');
  });

  test('a valid reading is saved', async () => {
    const res = await addReading(token, { reading_date: dateString(-2), slot: 'morning', value: 110 });
    expect(res.status).toBe(201);
    expect(res.body.value).toBe(110);
  });

  test('only one reading per slot per day', async () => {
    const date = dateString(-4);
    await addReading(token, { reading_date: date, slot: 'morning', value: 100 });
    const res = await addReading(token, { reading_date: date, slot: 'morning', value: 105 });
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('You already have an Morning (fasting) reading for this date.');
  });

  test('maximum 4 readings per day', async () => {
    const date = dateString(-5);
    const slots = ['morning', 'after_breakfast', 'after_lunch', 'after_dinner'];
    for (const slot of slots) {
      const ok = await addReading(token, { reading_date: date, slot, value: 120 });
      expect(ok.status).toBe(201);
    }
    const res = await addReading(token, { reading_date: date, slot: 'morning', value: 120 });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('You can add only 4 readings per day.');
  });
});

describe('Access control', () => {
  test('readings need a login', async () => {
    const res = await request(app).get('/readings');
    expect(res.status).toBe(401);
  });

  test('a user only sees their own readings', async () => {
    const mine = await request(app).get('/readings').set('Authorization', `Bearer ${token}`);
    const theirs = await request(app).get('/readings').set('Authorization', `Bearer ${otherToken}`);
    expect(mine.body.length).toBeGreaterThan(0);
    expect(theirs.body.length).toBe(0);
  });
});