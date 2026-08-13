# ROADMAP — Scarsi League

Derivata dal documento di visione (19 sezioni). Priorità decise con Alessandro.
Regola: un rilascio piccolo e funzionante batte tre rilasci a metà.

## ✅ Già fatto (v0.1 → v1.15.1)

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
- **v1.0 "Il Debutto"**: redesign navigazione a due livelli (5 voci
  principali con icone disegnate su misura, tab bar fissa su mobile,
  barra orizzontale su desktop, sotto-tab per sezione, barra di
  contesto stagione/lega) su tutte le pagine · XP e livelli calcolati
  automaticamente dai dati esistenti, sempre all-time, con progressione
  Esordiente→Leggenda mostrata in "Tu", su ogni carta e in classifica
  (§6) · login solo email+password con conferma email e magic link di
  riserva, Google disattivabile con una riga · errori tradotti in
  italiano ovunque, stati vuoti gestiti con eleganza, meta/OpenGraph e
  favicon a tema
- **v1.1 → v1.14 "La Piattaforma" (parziale)**: multi-tenancy vera con RLS
  per-lega (isolamento dati tra leghe, non solo whitelist) · wizard "Crea la
  tua lega" con inviti, QR code, pannello abbonamenti super-admin (§18) ·
  ruoli organizzatore/coorganizzatore oltre ad admin/membro (§19) ·
  switcher multi-lega, hub cross-lega in home, `/leghe` pubblica, `/bacheca`
  con statistiche aggregate cross-lega · notifiche in-app (richieste,
  approvazioni, partite, premi) — solo in-app, non push/email (§14 in
  parte) · import rapido da singola partita via bookmarklet trascinabile,
  più veloce del copia-incolla manuale ma sempre "un click umano per
  partita" (§11, nodo legale invariato — vedi sotto) · pannello admin
  ristrutturato a schede, tabelle mobile-friendly · cancellazione lega con
  conferma nome esatto + backup interno automatico (pg_cron, 14 notti) dopo
  un incidente di dati reale
- **v1.15 "Dashboard organizzatore"**: tab "Squadra" nel pannello admin con
  dati privati per giocatore — affidabilità (1-5), conteggio no-show, note
  libere — visibili solo a chi gestisce la lega, mai ai membri (§10 in
  parte, senza pagamenti: quelli restano parcheggiati)
- **Eventi speciali (§15)**: risultava "da fare" ma era già praticamente
  possibile con il meccanismo `stagioni` esistente — creare una stagione
  chiamata "Christmas Cup", spostarci le partite dalla tabella Partite,
  e il selettore stagione dà da solo una classifica generale, marcatori,
  media voto, MVP e Hall of Fame completamente separati (`assemble()`/
  `buildStats()` in `lib/engine.js` sono funzioni pure sui match passati,
  nessuna fuga dalla stagione principale). L'unico vero buco trovato:
  i premi assegnati dall'admin non erano filtrati per stagione sulla
  card giocatore — corretto in v1.15.1. Nota per un torneo molto corto
  (1 partita a giocatore): la soglia "presenze ≥ 2" della Hall of Fame fa
  restare vuoti i premi Classifica/Miglior media — non è un bug, è la
  stessa soglia usata ovunque, ma vale la pena saperlo prima di
  organizzare un evento di una sola partita

Con questo, "v1.1 — La Piattaforma" è completa: nessuna voce rimasta
aperta, il resto è nel parcheggio sotto.

## 🔮 Dopo (parcheggiate consapevolmente)

- Community (§17) — **in corso**: FASE A (commenti + reazioni emoji su
  ogni partita, v1.16.0) spedita. Restano FASE B (sondaggi) e FASE C
  (pronostici sulle partite in programma — richiede una tabella nuova
  per partite non ancora giocate, `partite` oggi rappresenta solo
  partite disputate).
- Notifiche push/email, oltre a quelle in-app già fatte (§14)
- Import automatizzato senza intervento umano (§11 flusso futuro) —
  ⚠ NODO LEGALE: per uso commerciale/multi-lega serve accordo con Fubles
  (ToS + GDPR dati di terzi). Il bookmarklet velocizza il click umano, non
  lo elimina. Per ora l'import resta comunque azionato da una persona, per
  la propria lega. Alternativa se si apre a terzi: inserimento risultati
  da parte degli organizzatori.
- App mobile nativa
- Penalità XP per no-show/pagamenti (§6) — sensibile, deciderà Alessandro
  se e come, meglio evitare gogna pubblica automatica
- Backup gestiti veri (piano Supabase Pro o export periodico fuori dal
  DB) — il backup interno attuale (pg_cron) copre solo l'errore umano più
  probabile (una lega cancellata per sbaglio), non un disastro sul database

## Note di prodotto

- I gol individuali Fubles sono strutturalmente incompleti: ogni feature sui
  marcatori deve conviverci (etichette "parziale", niente quadrature forzate)
- Gli assist NON esistono su Fubles: arrivano solo dai dati manuali (§12)
- "Miglior portiere" non esiste su Fubles: premio assegnato dall'admin (§12)
- Il tono del brand è autoironico ("Scarsi League"): i premi divertenti (§8)
  sono benvenuti, ma mai umilianti su dati sensibili (pagamenti, assenze)
