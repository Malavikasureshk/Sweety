# Sweety

Sweety is a small web app I built for tracking blood glucose. A person with diabetes can log up to 4 readings a day (morning fasting, after breakfast, after lunch, after dinner) and then look at daily, month-to-date and previous-month reports.

I built it with Node.js and Express for the API, PostgreSQL for the database, and React (with Vite) for the frontend.

## What it does

- You can sign up and log in. Passwords are hashed with bcrypt, and the app uses a JWT to remember who is logged in.
- You can add, view, edit and delete your readings. Everyone only sees their own.
- Every reading is checked on the server, and the error messages show up in the UI. The rules are: a value is required, it has to be a whole number between 40 and 600, only one reading per slot per day, a maximum of 4 per day, and no future dates.
- The Reports tab shows the highest, lowest and average (rounded to 1 decimal) plus the number of readings. If there is nothing to show, you get a friendly empty message instead of zeros.

## Before you start

You need Node.js (18 or newer) and PostgreSQL (14 or newer) installed.

## Getting it running

1. Installed the packages

```bash
cd server
npm install
cd ../client
npm install
```

2. Set up the database

Create a database called `sweety` and load the tables from the schema file:

```bash
psql -U postgres -c "CREATE DATABASE sweety;"
psql -U postgres -d sweety -f server/db/schema.sql
```

My PostgreSQL runs on port 5434 instead of the usual 5432, so if yours is on a different port too, add `-p <your port>` to both commands.

3. Create your .env file

```bash
cd server
cp .env.example .env
```

On Windows PowerShell, use `copy .env.example .env` instead. Then open `server/.env` and fill in these three things:

- `PORT`: the port for the API. 5000 is fine.
- `DATABASE_URL`: your PostgreSQL connection string. One thing that tripped me up: if your password has an `@` in it, write it as `%40` in the URL, otherwise the connection fails.
- `JWT_SECRET`: any long random text.

The client has a `client/.env.example` with `VITE_API_URL`. You only need it if your API is not on `http://localhost:5000`.

4. Add the demo data

```bash
cd server
npm run seed
```

This creates a demo user with about 70 days of sample readings, so the reports have something to show right away:

- Email: `demo@sweety.com`
- Password: `demo1234`

You can run the seed as many times as you like. It deletes and recreates the demo user each time.

## Running the app

Open two terminals.

Terminal 1, the API (runs on http://localhost:5000):

```bash
cd server
npm run dev
```

Terminal 2, the frontend (runs on http://localhost:5173):

```bash
cd client
npm run dev
```

Then open http://localhost:5173 and log in with the demo account, or create your own.

## Running the tests

```bash
cd server
npm test
```

The database needs to be set up first, because the tests talk to it directly. There are 17 tests in two files. They check that passwords are hashed, that login fails with a wrong password, every validation rule and its error message, that one user can't see another user's readings, and the report numbers and date ranges. Each test file makes its own users and deletes them when it's done, so it won't mess up your data.

## API routes

All the `/readings` and `/reports` routes need an `Authorization: Bearer <token>` header. You get the token from `/auth/login`.

- `POST /auth/register` creates an account
- `POST /auth/login` logs in and returns a token
- `GET /readings` lists your readings (add `?date=YYYY-MM-DD` to filter by day)
- `POST /readings` adds a reading
- `PUT /readings/:id` edits a reading
- `DELETE /readings/:id` deletes a reading
- `GET /reports/daily?date=YYYY-MM-DD` is the daily report, with each reading and its slot
- `GET /reports/month-to-date?date=YYYY-MM-DD` runs from the 1st of the month up to that date
- `GET /reports/monthly?date=YYYY-MM-DD` covers the whole month before the one that date is in

## Notes



- "Previous month" means the month before the selected date's month. So with 15 Oct 2026 selected, it covers 1 Sep to 30 Sep 2026, like the example in the brief.
- If no date is given to a report, it uses today. A future date is rejected.
- "Today" for the future-date check is the server's local date.
- Glucose values have to be whole numbers, so 100.5 is rejected.
- The edit form follows the same rules as adding (max 4 per day, one per slot), ignoring the reading being edited so it doesn't clash with itself.
- Login tokens last one day and are stored in the browser's localStorage. It's simple and fine for this project, but not the safest option.
- I used a database `UNIQUE` constraint and `CHECK` rules as a safety net, but the API checks everything first so the user gets a readable message.

### What I'd do with more time

- Add pagination to the readings list and a line chart of the month.
- Add a `docker-compose.yml` so PostgreSQL starts with one command.
- Write frontend tests with React Testing Library for the reading form.
- Move the token into an httpOnly cookie, and add rate limiting on login.
- Wrap the "count readings, then insert" check in a database transaction. Right now two requests at the exact same moment could in theory squeeze in a fifth reading.
- Add a proper date picker that blocks future dates visually everywhere, not just on the add form.