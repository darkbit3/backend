# Shmeta Backend

Node.js + Express REST API for the Shmeta platform using PostgreSQL.

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
- Start the backend and verify `/health` plus the login and registration flows

The application requires PostgreSQL at startup and fails clearly when the connection URL is missing or unreachable.
