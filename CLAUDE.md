# CLAUDE.md — Scarsi League

Contesto per sessioni di sviluppo. Leggere per intero prima di scrivere codice.

## Cos'è

Piattaforma per leghe amatoriali di calcetto/calciotto, companion di Fubles
(non lo sostituisce: Fubles gestisce partite/iscrizioni/voti, noi trasformiamo
i dati in statistiche, carte stile Ultimate Team, classifiche, premi).
Lega fondatrice: "Calci8Lunedì" (Centro Sportivo Bettinelli, Milano).
Visione completa in ROADMAP.md.

## Stack e deploy

- **Next.js 14 (App Router)** — tutto client component (`"use client"`), niente API routes per ora
- **Supabase**: Postgres + Auth (magic link; Google OAuth predisposto ma NON ancora configurato) + Storage (bucket `avatars`, pubblico)
- **Vercel**: progetto `scarsi-league` — dominio principale **https://scarsileague.it** (custom), backup scarsi-league.vercel.app
- Repo GitHub: `miraglia93/scarsi-league` — codice nella **radice** del repo (nessun Root Directory su Vercel)
- Deploy: push su `main` → build automatica Vercel. NOTA: auto-assignment domini disattivato → a volte serve "Promote to Production" manuale
- Env: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (in Vercel e in `.env.local`)

## Struttura attuale (v0.7.1)

```
scarsi-league/  (radice repo)
├── app/
│   ├── page.jsx          # home: login, consenso, richiesta accesso, dashboard completa
│   ├── admin/page.jsx    # pannello admin: richieste, membri, leghe
│   ├── profilo/page.jsx  # claim scheda, nickname/numero/ruolo, upload foto
│   ├── privacy/page.jsx  # privacy policy statica
│   ├── layout.jsx
│   └── globals.css       # tutto lo stile (niente Tailwind)
├── lib/supabaseClient.js
└── package.json          # versione = release; bump ad ogni rilascio
```

## Database (Supabase)

Tabelle: `leghe`, `giocatori` (nickname, numero_maglia, foto_url, visibilita_pubblica),
`partite` (match_id UNIQUE = chiave anti-duplicati import), `prestazioni`
(unique partita+giocatore; voto, gol, motm, esito), `voti_ricevuti`
(418 voti individuali reali; flag `anomalo` esclude outlier dalle medie),
`membri_autorizzati` (whitelist; ruolo membro/admin; giocatore_id = claim,
unique), `richieste_accesso`, `consensi`, `import_log`.
Views: `v_classifica` (punti 3-1-0), `v_voti_puliti`, `v_giocatori_claimed`.
RPC (security definer): `is_admin()`, `claim_giocatore(gid)`,
`approva_richiesta(p_email)`, `rifiuta_richiesta(p_email)`.

Migrazioni finora eseguite a mano nell'SQL Editor (file: schema.sql,
seed_test5.sql, whitelist.sql, richieste_accesso.sql, consensi.sql,
v07_piattaforma.sql). `schema.sql` e `seed_test5.sql` recuperati e
archiviati in `migrations/legacy/` il 13/08/2026 (erano ancora salvati
nella sidebar dell'SQL Editor di Supabase); gli altri quattro restano
persi. D'ora in poi: creare file numerati in `migrations/` e NON
modificare i vecchi.

## ⚠ Trappole già incontrate (non ripeterle)

1. **RLS + `.maybeSingle()`**: l'admin vede TUTTE le righe di
   membri_autorizzati/richieste_accesso → `.maybeSingle()` esplode.
   SEMPRE filtrare esplicitamente: `.eq("email", emailUtente)`. (Bug v0.7,
   fixato in v0.7.1.)
2. **Policy RLS ricorsive**: policy su membri_autorizzati che interroga se
   stessa → infinite recursion. Usare la funzione `is_admin()` security definer.
3. **Marcatori Fubles incompleti**: solo ~26 gol attribuiti su 67. Le
   classifiche marcatori vanno SEMPRE etichettate come parziali. Mai far
   quadrare i gol individuali col risultato: non quadrano.
4. **Voti anomali**: esiste un voto "10" fuori scala (flag `anomalo=true`);
   le medie "pulite" usano v_voti_puliti.
5. **~56 giocatori in 5 partite** (partite pubbliche Fubles, tanto turnover):
   ogni classifica/carta di default filtra `presenze >= 2` con toggle "Tutti".
6. **Overall carte auto-calibrato**: z-score sulla distribuzione voti della
   lega (medie reali compresse tra 6.2 e 7.2), NON soglie fisse.

## Convenzioni

- UI e testi in **italiano**, tono da spogliatoio (sfottò bonario ok)
- Tema "stadio di notte": bg #0B1210, superficie #121B17, oro #E3C567,
  chalk #E8EDE6, muted #8FA096, win #5CBF7A, loss #E05C4B. Font: Anton
  (display) + Archivo (testo). Riusare le classi di globals.css
- Carte: tier gold ≥82 / silver ≥72 / bronze; le bronze sono lo
  "Scarso Certificato" (ironia = brand)
- Privacy by design: `visibilita_pubblica` default false; niente dati
  giocatori fuori dalla whitelist; consenso registrato in `consensi`
- Prima di ogni commit: `npm run build` DEVE passare
- Un rilascio = un bump di versione in package.json + commit message
  "vX.Y.Z — descrizione"

## Persone

- Alessandro Miraglia = owner/admin (email in membri_autorizzati con
  ruolo admin; scheda giocatore #93). Decide lui priorità e merge.
- Import dati: gestito da Claude in Chrome con prompt dedicati (vedi
  README), NON da questo progetto.
