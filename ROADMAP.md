# ROADMAP — Scarsi League

Derivata dal documento di visione (19 sezioni). Priorità decise con Alessandro.
Regola: un rilascio piccolo e funzionante batte tre rilasci a metà.

## ✅ Già fatto (v0.1 → v0.9.0)

- Home lega: hero ultima partita, statistiche, classifica generale con forma,
  AI insight (§1 in parte)
- Classifiche di specialità: marcatori (parziali), media voto, MVP, presenze (§5 base)
- Carte giocatore con overall auto-calibrato, tier, foto, nickname (§4 base)
- Profilo: claim scheda, nickname, numero, ruolo, foto (§3 base)
- Record + chemistry/nemesis + miglior fan/critico dai voti individuali (§9 in parte)
- Auth magic link, consenso privacy con registro, whitelist con richieste
  accesso + QR da campo, pannello admin, multi-lega nel DB + selettore (§10/§18/§19 in parte)
- Import Fubles via Claude in Chrome con match_id anti-duplicati (§11)
- **v0.8 "Il Lunedì"**: pagina partita `/partita/[id]` con formazioni, media
  voto, migliore in campo (§2) · report WhatsApp con un tap (§13) · Team of
  the Week con grafica campo screenshot-friendly (§7) · prima infornata badge
  (presenze, gol, MVP, serie vittorie, Saracinesca, Scarso Certificato) su
  carta e scheda giocatore (§6)
- **v0.9 "La Stagione"**: refactoring in `lib/engine.js` + `components/` ·
  login email+password con registrazione libera, reset password, magic link
  e Google (§10) · stagioni come entità con selettore in nav e opzione
  "tutte le stagioni" (§5 filtri) · `/hall-of-fame` con vincitori per
  stagione conclusa (§16) · dati manuali post-partita dall'admin (assist,
  clean sheet, gol subiti, cartellini, autogol) e sezione Premi (§12) ·
  gestione admin di partite/stagioni (elimina con conferma forte, sposta
  partite tra stagioni, apri/chiudi/attiva stagioni) · classifiche assist e
  clean sheet, Player of the Month automatico con carta speciale (§4/§8) ·
  premi in bacheca profilo e pagina partita · grafici SVG andamento
  voto/overall nel profilo (§3 andamento)

## v1.0 — "La Piattaforma"

- Dashboard organizzatore completa: affidabilità giocatori (dato privato),
  no-show, note interne (§10) — ⚠ NIENTE gestione pagamenti reali per ora:
  solo flag pagato/non pagato manuale, nessun movimento di denaro
- Wizard "Crea la tua lega" completo con inviti (§18)
- Ruoli: organizzatore/collaboratore oltre ad admin/membro (§19)
- XP e livelli (Esordiente→Leggenda) (§6)
- Eventi speciali: Christmas Cup, tornei con classifiche separate (§15)

## 🔮 Dopo (parcheggiate consapevolmente)

- Community: commenti, sondaggi, pronostici (§17)
- Notifiche push/email (§14)
- Import automatizzato senza intervento umano (§11 flusso futuro) —
  ⚠ NODO LEGALE: per uso commerciale/multi-lega serve accordo con Fubles
  (ToS + GDPR dati di terzi). Per ora l'import resta manuale via Claude
  in Chrome per la propria lega. Alternativa se si apre a terzi:
  inserimento risultati da parte degli organizzatori.
- App mobile nativa
- Penalità XP per no-show/pagamenti (§6) — sensibile, deciderà Alessandro
  se e come, meglio evitare gogna pubblica automatica

## Note di prodotto

- I gol individuali Fubles sono strutturalmente incompleti: ogni feature sui
  marcatori deve conviverci (etichette "parziale", niente quadrature forzate)
- Gli assist NON esistono su Fubles: arrivano solo dai dati manuali (§12)
- "Miglior portiere" non esiste su Fubles: premio assegnato dall'admin (§12)
- Il tono del brand è autoironico ("Scarsi League"): i premi divertenti (§8)
  sono benvenuti, ma mai umilianti su dati sensibili (pagamenti, assenze)
