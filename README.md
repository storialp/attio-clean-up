# Attio Cleanup Deck

A Next.js app that:

- reads your Attio API key from server environment variables
- shows companies one at a time in a Tinder-style deck
- swipes left to delete
- swipes right to keep
- writes every successful delete into Postgres

## Local setup

1. Install dependencies:

```bash
npm install
```

2. Create `.env.local`:

```bash
ATTIO_API_KEY="your-attio-api-key"
POSTGRES_URL="your-postgres-connection-string"
```

3. Run the app:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Deploy to Vercel

1. Push this repo to GitHub.
2. Import it into Vercel.
3. Add a Postgres database through Vercel Storage or another provider that exposes `POSTGRES_URL`.
4. Deploy.

## Notes

- The app does not persist the Attio API key in the database.
- The Attio key stays server-side and is never exposed in the client UI.
- The `deleted_companies` table is created automatically on first use.
- If your database provider does not expose `POSTGRES_URL`, you can use `DATABASE_URL` instead.
