# Monday League ⚽

Dashboard della lega di calciotto del lunedì — dati importati da Fubles via Claude in Chrome,
database Supabase, frontend Next.js.

## Setup locale

1. `cp .env.local.example .env.local` e inserisci URL + anon key del progetto Supabase
2. `npm install`
3. `npm run dev` → http://localhost:3000

## Autenticazione

Accesso via magic link email (Supabase Auth). In Supabase:
**Authentication → URL Configuration** → imposta Site URL su `http://localhost:3000`
(in produzione: l'URL Vercel).

## Deploy su Vercel

1. Push del repo su GitHub
2. Su vercel.com → Add New Project → importa il repo
3. In **Environment Variables** aggiungi `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Deploy → aggiorna il Site URL in Supabase Auth con l'URL Vercel

## Struttura

- `app/page.jsx` — login, fetch dati live, motore statistiche, UI
- `app/globals.css` — tema "stadio di notte" (Anton + Archivo, oro Ultimate Team)
- `lib/supabaseClient.js` — client Supabase
- Database: vedi `schema.sql` e `seed_test5.sql`

## Import nuove partite

L'estrazione via Claude in Chrome produce le 4 tabelle (PARTITE, PRESTAZIONI_GIOCATORI,
FORMAZIONI, VOTI_RICEVUTI). `match_id` è UNIQUE: reimportare la stessa partita fallisce
invece di duplicare.
