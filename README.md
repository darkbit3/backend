# Shmeta Backend

Node.js + Express + SQLite REST API for the Shmeta platform.

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
- Set `DB_PATH=./data/database.sqlite`
