# mini-writer

Authoring tool for Sidekick mini lessons.

## Local setup

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env` and add the Supabase and Anthropic values when available.
3. Run `npm run dev`.

Without environment variables, the app uses seeded local fallback data in the browser so the UI can be reviewed.

## Supabase

Create the prefixed `mini_writer_*` tables in `supabase/schema.sql`. The browser never receives the Supabase service role key; all persisted writes go through Netlify Functions.

## Netlify

Set these environment variables in Netlify:

- `ANTHROPIC_API_KEY`
- `ANTHROPIC_MODEL` (defaults to `claude-opus-4-7`)
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
