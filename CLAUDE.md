# CLAUDE.md — Scarsi League

Contesto per sessioni di sviluppo. Leggere per intero prima di scrivere codice.

## Cos'è

Piattaforma per leghe amatoriali di calcetto/calciotto, companion di Fubles
(non lo sostituisce: Fubles gestisce partite/iscrizioni/voti, noi trasformiamo
i dati in statistiche, carte stile Ultimate Team, classifiche, premi).
Lega fondatrice: "Calci8Lunedì" (Centro Sportivo Bettinelli, Milano).
Visione completa in ROADMAP.md.

## Stack e deploy

- **Next.js 14 (App Router)** — quasi tutto client component (`"use client"`);
  unica eccezione: `app/api/push/send/route.js` (route handler server-side,
  necessaria per le push — richiede una chiave privata che non può stare nel
  client). Nessun'altra API route per ora.
- **Supabase**: Postgres + Auth (magic link; Google OAuth predisposto ma NON ancora configurato) + Storage (bucket `avatars`, pubblico)
- **Vercel**: progetto `scarsi-league` — dominio principale **https://scarsileague.it** (custom), backup scarsi-league.vercel.app
- Repo GitHub: `miraglia93/scarsi-league` — codice nella **radice** del repo (nessun Root Directory su Vercel)
- Deploy: push su `main` → build automatica Vercel. NOTA: auto-assignment domini disattivato → a volte serve "Promote to Production" manuale
- Env: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (client, in Vercel e in `.env.local`) ·
  `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
  (per le push — le ultime due SOLO server-side, mai esporle al client, mai committarle)

## Struttura attuale (v1.30.1)

Nota: `components/` è cresciuta parecchio e cresce ad ogni feature — se
questo elenco sembra corto rispetto a quello che trovi nella cartella,
fidati della cartella, non di questo file (vale la pena tenerlo
aggiornato, ma non è garantito che lo sia al 100%).

```
scarsi-league/  (radice repo)
├── app/
│   ├── page.jsx              # home: login, consenso, richiesta accesso, dashboard completa
│   ├── bacheca/page.jsx      # statistiche aggregate su TUTTE le leghe (non una lega sola)
│   ├── leghe/page.jsx        # elenco leghe pubbliche (leghe.pubblica) + link a crea-lega
│   ├── crea-lega/page.jsx    # flusso di creazione di una nuova lega
│   ├── admin/page.jsx        # entry point pannello admin (la UI vera è in components/PannelloGestioneLega.jsx)
│   ├── profilo/page.jsx      # claim scheda, nickname/numero/ruolo, foto, opt-out visibilità pubblica
│   ├── partita/[id]/page.jsx # dettaglio partita: formazioni, commenti, tab Squadra (capitani/voti), tab Live (cronista)
│   ├── live/[codice]/page.jsx # vista pubblica in diretta — unica pagina senza login di tutta l'app
│   ├── hall-of-fame/page.jsx # storico/classifiche per stagione
│   ├── reset/page.jsx        # reset password
│   ├── privacy/page.jsx      # privacy policy statica
│   ├── api/push/send/route.js# unica route server-side (invio push, chiave privata)
│   ├── layout.jsx, error.jsx, global-error.jsx, manifest.js, icon.jsx, apple-icon.jsx, opengraph-image.jsx
│   └── globals.css           # tutto lo stile (niente Tailwind)
├── components/    # un componente per feature, tutti "use client"; tra i principali:
│   │                PannelloGestioneLega (il grosso della UI admin), CapitanoSquadra,
│   │                ProposteIncrociate, VotiCapitano, LiveCronista, NotificheBell,
│   │                MenuAccount, SelettoreLega, PlayerCard, Sondaggi, PushSetup
├── lib/
│   ├── supabaseClient.js     # client Supabase condiviso
│   ├── engine.js             # tutto il calcolo puro: assemble/buildStats/XP/livelli/precedenza dati
│   ├── importFubles.js       # parser dei 3 formati di import (Excel, bookmarklet post/pre-match)
│   ├── bookmarklet.js / bookmarkletPreMatch.js  # script che girano sulla pagina Fubles
│   ├── push.js                # Web Push (subscribe/unsubscribe)
│   └── recapImage.js          # genera l'immagine riepilogo condivisibile
├── migrations/    # file numerati v13.sql, v14.sql, ... — vedi sezione Database
└── package.json               # versione = release; bump ad ogni rilascio
```

## Database (Supabase)

25 tabelle a oggi (v31.sql), raggruppate per area:
- **Core**: `leghe` (pubblica = opt-in per l'elenco su /leghe), `stagioni`
  (peso_voto_capitano = configurazione per-stagione del voto arricchito),
  `giocatori` (nickname, numero_maglia, foto_url, visibilita_pubblica —
  opt-out dalla pagina live pubblica, gestito da ciascuno in Profilo),
  `partite` (match_id UNIQUE = chiave anti-duplicati import; stato_live,
  condivisione_pubblica, codice_live per il live match), `prestazioni`
  (unique partita+giocatore; voto, gol, motm, esito).
- **Voti**: `voti_ricevuti` (flag `anomalo` esclude outlier dalle medie),
  `voti_capitano` (voto arricchito, capitano vota gli avversari).
- **Accesso/whitelist**: `membri_autorizzati` (ruolo membro/admin/
  coorganizzatore; giocatore_id = claim, unique), `richieste_accesso`,
  `consensi`.
- **Live match**: `cronisti_partita` (ruolo per-partita, copre entrambe
  le squadre), `capitani_partita` (ruolo per-partita, una squadra),
  `dati_manuali` (correzioni/eventi live: mai toccata dal re-import
  Fubles — vedi `applicaGolManuali`/`applicaVotoArricchito` in
  `lib/engine.js`), `dati_manuali_proposte` (proposte del capitano per
  la squadra avversaria, soggette ad approvazione).
- **Community**: `sondaggi`, `opzioni_sondaggio`, `voti_sondaggio`,
  `commenti_partita`, `reazioni_commento`, `premi`.
- **Piattaforma**: `utenti_piattaforma`, `notifiche`, `push_subscriptions`,
  `import_log`, `dati_organizzativi`, `backup_snapshot`.

Views: `v_classifica` (punti 3-1-0), `v_voti_puliti`, `v_giocatori_claimed`.
RPC (security definer, controllo di autorizzazione interno ad ognuna —
non fidarsi del solo GRANT): `is_admin()`, `is_super_admin()`,
`is_membro_lega`/`is_admin_lega`/`is_gestore_lega`/`is_capitano_partita`/
`is_cronista_partita` (helper di RLS), `claim_giocatore`, `crea_lega`,
`elimina_lega`, `leghe_pubbliche`, `lega_da_slug`, `membri_display`,
`nomi_registrati`, `approva_richiesta`/`rifiuta_richiesta`,
`approva_proposta_dati`/`rifiuta_proposta_dati`, `crea_backup_giornaliero`.

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
- Privacy by design: di regola niente dati giocatori fuori dalla
  whitelist (membri della lega); consenso registrato in `consensi`.
  Unica eccezione deliberata: la pagina pubblica `/live/[codice]`
  (v1.30, nessun login) — mostra nome/foto di chi gioca solo se
  `giocatori.visibilita_pubblica = true` (default true dalla v31, opt-out
  in Profilo) E la partita ha `condivisione_pubblica = true` (opt-in
  per-partita del gestore). Voti e MVP restano privati anche lì.
- Prima di ogni commit: `npm run build` DEVE passare
- Un rilascio = un bump di versione in package.json + commit message
  "vX.Y.Z — descrizione"

## Persone

- Alessandro Miraglia = owner/admin (email in membri_autorizzati con
  ruolo admin; scheda giocatore #67 nella lega Calci8Lunedì, lega_id 3).
  Decide lui priorità e merge.
- Import dati: gestito da Claude in Chrome con prompt dedicati (vedi
  README), NON da questo progetto.
