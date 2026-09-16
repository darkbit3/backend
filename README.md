# Shmeta Backend

Node.js + Express REST API for the Shmeta platform. PostgreSQL is supported for persistent deployments; SQLite remains available for local tests and development.

## Setup

```bash
npm install
cp .env.example .env   # fill in your secrets
npm run db:init        # seed the database
npm run dev            # development with nodemon
```

## Scripts

| Script | Description |
|---|---|
| `npm start` | Production server |
| `npm run dev` | Development with auto-reload |
| `npm run db:init` | Initialize & seed the database |

## Environment Variables

See `.env.example` for all required variables.

## Deploy on Render

- **Service type**: Web Service
- **Build Command**: `npm install`
- **Start Command**: `npm start`
- Set all variables from `.env.example` in Render's Environment tab
- Set `NODE_ENV=production`
- Set `DATABASE_URL` to the PostgreSQL connection string
- Remove `USE_SQLITE` or set it to `false`

## Switch from SQLite to PostgreSQL

1. Create or attach a PostgreSQL database and copy its connection URL.
2. Back up `data/database.sqlite` before changing database settings.
3. Set `DATABASE_URL=<your PostgreSQL URL>`.
4. Remove `USE_SQLITE=true` or set `USE_SQLITE=false`.
5. Run `npm run db:init` to create the PostgreSQL schema and seed configured accounts.
6. Run `npm run db:migrate:postgres` to copy existing SQLite application data into PostgreSQL.
7. Start the backend and verify `/health` plus the login and registration flows.

The application now fails at startup when PostgreSQL is enabled but the URL is missing or unreachable; it does not silently fall back to SQLite.
