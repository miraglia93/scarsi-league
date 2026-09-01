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
- **Community (§17)**: commenti + reazioni emoji su ogni partita
  (v1.16.0) · sondaggi per lega, scelta singola, creati dal gestore
  (v1.17.0). La terza gamba prevista (pronostici sulle partite in
  programma) è stata **accantonata consapevolmente**, non solo rimandata
  — vedi sotto.

Con questo, "v1.1 — La Piattaforma" è completa: nessuna voce rimasta
aperta, il resto è nel parcheggio sotto.

- **Notifiche push (§14)**: web push del browser (non email), primo pezzo di
  codice server del progetto (`app/api/push/send`, VAPID) dato che spedire una
  push richiede per forza una chiave privata lato server. Quattro eventi:
  richiesta di accesso in attesa (a chi gestisce la lega), richiesta approvata
  (a chi l'ha fatta), nuova partita importata (a tutti i membri), premio
  assegnato (al giocatore). Attivabile dal profilo, per singolo device/browser.
- **Audit UX generale (v1.18.1 → v1.18.3)**: giro completo del sito per rifinire
  esperienza e gestione prima di aprire ai pagamenti. Bug vero corretto: una
  stagione attiva vuota nascondeva l'intera app (Classifiche/Partite/Giocatori
  inclusi) dietro il wizard di onboarding admin, anche con altre stagioni piene
  di dati — ora appare solo se la lega non ha mai avuto partite. Rifiniture:
  nomi giocatore normalizzati a Title Case ovunque invece di restare come
  scritti su Fubles (minuscolo/maiuscolo a caso), placeholder di account Fubles
  cancellati ("Disabled User") rietichettati invece di comparire così com'è in
  grafiche condivisibili, Team of the Week con pulsante di condivisione
  WhatsApp (mancava, a differenza della pagina partita), sotto-tab mobile con
  sfumatura ai bordi per segnalare lo scroll orizzontale, colonna Ruolo
  separata da Piano nel pannello Piattaforma. Non affrontato per ora (impatto
  basso, costo alto): skeleton loading al posto del "Caricamento…" a schermo
  intero — schermo per schermo, da rivalutare se serve davvero.
- **Modifica partite + capitani (v1.19.0 → v1.21.0)**: chi gestisce la lega
  può ora correggere direttamente data/squadre/risultato di una partita già
  importata (v1.19.0). Introdotti i "capitani": due ruoli assegnati dal
  gestore per singola partita (uno per squadra, dato che Bianchi/Neri si
  rimescolano ogni lunedì), con un nuovo sotto-tab "Squadra" sulla pagina
  della partita da cui inseriscono gol/assist/cartellini/clean sheet per i
  giocatori della propria squadra (v1.20.0). Vincolo tecnico chiave: i gol
  corretti a mano NON toccano mai `prestazioni.gol` (sovrascritto ad ogni
  re-import da Fubles) — vivono in `dati_manuali.gol_manuale`, applicato da
  `applicaGolManuali()` prima di ogni calcolo di classifiche/carte. Un
  capitano può anche proporre le stesse correzioni per la squadra
  avversaria: restano in sospeso finché il capitano bersaglio (o il
  gestore, dal pannello admin) le approva o rifiuta — stesso schema
  in_attesa/approvata/rifiutata già usato per le richieste di accesso
  (v1.21.0, tabella `dati_manuali_proposte` + RPC `approva_proposta_dati`/
  `rifiuta_proposta_dati`). Tre nuovi eventi push aggiunti allo stesso
  sistema esistente (§14): capitano nominato (a chi viene assegnato),
  proposta ricevuta (al capitano bersaglio e al gestore), proposta
  approvata/rifiutata (a chi l'ha proposta) — v1.22.0. Aggiunta anche
  una campanella di notifiche in-app (v1.23.0, tabella `notifiche` +
  Supabase Realtime): stesso evento della push ma sempre visibile,
  senza bisogno di attivare nulla, con badge dal vivo (nessun refresh
  di pagina) e link diretto al punto giusto quando ci si clicca sopra.
- **Riordino pannello admin (v1.24.0)**: fix di un bug reale — quando la
  stagione selezionata di default non ha ancora partite, l'intera
  sezione "Lega" (sotto-tab inclusi, quindi anche "⚙ Gestione") spariva
  dietro un messaggio piatto senza alcun link al pannello; ora chi
  gestisce la lega trova sempre un link diretto. Aggiunta anche una
  scorciatoia "⚙ Pannello admin" nel menu account per chi gestisce
  almeno una lega, invece del solo sotto-tab nascosto. La tab "Partite"
  del pannello (cresciuta parecchio con capitani/proposte) è stata
  spezzata in tre sotto-tab — Elenco / Dati & capitani / Importa —
  con un filtro per stagione sull'elenco partite (pre-impostato sulla
  più recente) invece dell'unica lunga lista di tutte le stagioni.
- **v1.24.1**: due rifiniture emerse testando il pannello a mano. La
  tabella "Dati partita" mescolava i giocatori di entrambe le squadre
  senza indicarlo — aggiunta la colonna "Squadra" e raggruppamento in
  ordine. Chi gestisce la lega non aveva modo di vedere cosa vede
  davvero un capitano senza usare un secondo account: ora, se non sei
  tu stesso capitano di quella partita, il sotto-tab "Squadra" della
  pagina partita ti mostra comunque entrambe le squadre in modalità
  "vista da gestore" (stessi componenti reali usati dai capitani, non
  una finta anteprima), lasciando fuori solo il modulo di proposta
  incrociata riservato a chi è davvero nominato.
- **Voto arricchito dei capitani, FASE A (v1.25.0)**: primo pezzo di un
  piano a tre fasi. I capitani potranno votare i giocatori della
  squadra AVVERSARIA (mai i propri compagni, per imparzialità) e
  moderare i voti "pigri" dei propri compagni (es. 6.5 a tutti, un
  pattern comune su Fubles) — usando i voti individuali che Fubles
  espone e che noi già importiamo in `voti_ricevuti` ma non abbiamo mai
  mostrato partita per partita. Il voto Fubles resta sempre il numero
  di base, sempre disponibile anche sullo storico importato da nuove
  leghe (che non ha mai avuto capitani) — il voto arricchito si applica
  solo dove esiste, con un peso configurabile PER STAGIONE dal gestore
  (mai obbligatorio). In questa fase solo l'infrastruttura: colonna
  `stagioni.peso_voto_capitano` e tabella `voti_capitano`, nessun
  effetto ancora visibile sui voti — arriva in FASE B.
- **Voto arricchito dei capitani, FASE B (v1.26.0)**: i capitani ora
  votano davvero i giocatori della squadra avversaria (nuovo modulo
  "Vota gli avversari" sul tab Squadra, salvataggio diretto senza
  approvazione — è un giudizio, non una correzione di un fatto). Dove
  attivo, il voto arricchito sostituisce quello Fubles ovunque: media,
  overall della carta, e l'MVP della partita (che ora segue il voto più
  alto invece del flag `motm` di Fubles, quando i capitani hanno votato
  quella partita). Nessun effetto su partite/stagioni senza capitani —
  lo storico importato resta identico.
- **Voto arricchito dei capitani, FASE C (v1.27.0)**: chiude il piano a
  tre fasi. Il capitano vede ora, per la propria squadra, i voti che i
  compagni hanno dato in questa partita — raggruppati per chi ha
  votato, per far risaltare subito un pattern pigro (es. 6.5 a tutti).
  Due azioni: escludere tutti i voti di un compagno in blocco
  (suggerita) o un voto singolo, entrambe reversibili ("Ripristina").
  Nessuna nuova migrazione: usa la RLS di moderazione e il ricalcolo
  già introdotti in FASE A/B.
- **Live match, FASE A (v1.28.0)**: primo pezzo di un piano a tre fasi
  per seguire una partita in tempo reale invece che a giochi fatti.
  Verificato dal vivo che Fubles espone, PRIMA che la partita sia
  giocata, una tab "FORMAZIONI" con squadre/forza/giocatori (niente
  voti/gol, che non esistono ancora) — nuovo bookmarklet "Importa
  formazione pre-partita" che la legge, stesso `match_id` che si
  userà per l'import completo di sempre a fine partita. Nuova colonna
  `partite.stato_live` (programmata/in_corso/conclusa, null per il
  99% delle partite normali) e ruolo "cronista" per-partita (copre
  entrambe le squadre, a differenza del capitano) che potrà inserire
  eventi in diretta nelle fasi successive — scrivendo in
  `dati_manuali`, che l'import Fubles post-partita non tocca mai:
  la priorità "live prima di Fubles, sempre rivedibile dall'admin"
  richiesta arriva gratis dal meccanismo già esistente per i capitani.
- **Live match, FASE B (v1.29.0)**: la diretta vera e propria. Dal
  pannello admin il gestore nomina il cronista, dà il fischio d'inizio
  (`stato_live` → in_corso) e quello finale (→ conclusa), attiva la
  condivisione pubblica (genera un `codice_live` casuale al primo
  attivamento) e può aggiustare la formazione fino all'ultimo
  (aggiungere un giocatore, spostarlo di squadra, rimuoverlo — le
  formazioni cambiano spesso al campo). Il cronista, sulla pagina della
  partita, ha un nuovo SubTab "🔴 Live" con bottoni +1/-1 per gol,
  assist, cartellini e autogol per OGNI giocatore di ENTRAMBE le
  squadre (non solo la propria, a differenza del capitano) — ogni tap
  salva subito su `dati_manuali`. Il punteggio mostrato in testa alla
  pagina, mentre la partita è live, è calcolato sommando quei gol
  (`calcolaPunteggioLive`, nuova funzione pura in `lib/engine.js`, un
  autogol conta per la squadra avversaria) invece di leggere
  `gol_squadra_1/2`, che restano null finché non c'è un risultato
  ufficiale. Banner "🔴 IN DIRETTA" per chiunque guardi la partita
  mentre è in corso. Verificato dal vivo end-to-end su una partita di
  test: cronista che segna un gol e un autogol durante la diretta,
  fischio finale, poi il normale import Fubles post-partita (bookmarklet
  invariato) sullo stesso `match_id` — trovato e corretto un bug reale
  nel percorso di FASE A, dove il commento nel codice prometteva che
  l'import post-partita potesse chiudere un live match ma il controllo
  anti-duplicati lo bloccava sempre; ora, se la partita esistente ha
  `stato_live` impostato, l'import la aggiorna (marcandola "conclusa")
  invece di rifiutarsi. Confermato che il punteggio resta quello del
  cronista anche dopo l'arrivo del risultato Fubles, e che i voti
  arrivano correttamente da Fubles.
- **Live match, FASE C (v1.30.0)**: chiude il piano a tre fasi con la
  vista pubblica in diretta — nuova pagina `app/live/[codice]/page.jsx`,
  raggiungibile solo con il codice generato dal gestore, senza login né
  controlli di consenso/membro (prima superficie non autenticata
  dell'app). Mostra punteggio live, stato ("🔴 IN DIRETTA" / "✅
  conclusa" / "⏳ non ancora iniziata") e formazioni con marcatori,
  assist e cartellini — niente voti né MVP, dati più personali che
  restano riservati ai membri della lega. Sottoscrizione Supabase
  Realtime su `prestazioni`/`dati_manuali` filtrata sulla singola
  partita: chi guarda vede gol e cambi di formazione comparire da soli,
  senza dover ricaricare. Nuove policy RLS `to anon` (v30.sql) — sempre
  scoped alla singola partita con `condivisione_pubblica = true`, mai
  all'intera lega: `partite` in lettura se condivisa, `prestazioni` e
  `dati_manuali` via join su quella partita, `giocatori` via join sulle
  sole prestazioni di quella partita (mai l'intera rosa).
- **v1.30.1 — controllo generale post-FASE C**: richiesto esplicitamente
  da Alessandro dopo la chiusura del piano ("hai testato tutto? per
  sicurezza fai un controllo generale"). Rilette con occhio critico le
  policy nuove e trovate due cose reali. (1) La pagina pubblica non
  rispettava `giocatori.visibilita_pubblica` — colonna esistente da
  sempre (default false, stesso principio di `leghe.pubblica`, mai
  letta da nessuna policy prima d'ora perché nessun dato giocatore era
  mai uscito dalla whitelist) ma senza nessuna UI per attivarla:
  applicarla alla lettera avrebbe svuotato la pagina live per tutti.
  Scelta con Alessandro: `v31.sql` flippa il default a `true` e fa
  backfill (nessuno perde visibilità al lancio), la policy pubblica di
  `giocatori` ora richiede `visibilita_pubblica = true`, e in
  [Profilo](app/profilo/page.jsx) c'è un nuovo checkbox per disattivarla
  esplicitamente — RLS di scrittura già esistente ("membro modifica
  propria scheda"), nessuna nuova policy necessaria per il toggle. (2)
  Nell'Elenco partite del pannello admin non c'era modo di vedere a
  colpo d'occhio quali partite fossero condivise pubblicamente —
  aggiunto un indicatore 🌐 accanto allo stato/risultato. Controllati
  anche gli advisor di sicurezza per le funzioni RPC eseguibili da
  `anon` (es. `elimina_lega`): falso allarme, ognuna fa il proprio
  controllo di autorizzazione interno, pattern coerente in tutto il
  progetto e non collegato a FASE C.
- **v1.31.0 — fast-follow live match**: due dei fast-follow lasciati
  deliberatamente fuori scope nel piano originale, richiesti esplicitamente
  da Alessandro dopo la chiusura di FASE C. (1) **Notifiche push a inizio
  e fine diretta**: `impostaStatoLive()` invia ora un push a tutti i
  membri della lega (stesso destinatario di "nuova partita") quando il
  gestore dà il fischio d'inizio o quello finale — due nuovi `tipo` in
  `app/api/push/send/route.js` (`partita_live_iniziata`,
  `partita_live_conclusa`), che riusano la campanella in-app già
  esistente (stessa route scrive sia `notifiche` sia le push). (2)
  **Più di un cronista per partita**: il DB già lo supportava dal
  giorno uno (`cronisti_partita` ha `unique(partita_id, email)`, non un
  limite a una riga) e `is_cronista_partita()` già funzionava
  identicamente con 1 o N cronisti — mancava solo la UI, che assumeva
  un cronista singolo (select + stato stringa). Ora nel pannello admin
  è una lista di "chip" con aggiunta/rimozione libera, utile ad
  esempio per un cronista per squadra o un backup.

## 🔮 Dopo (parcheggiate consapevolmente)

- Pronostici sulle partite in programma (§17, terza gamba di Community)
  — **valutata e scartata**, non solo rimandata: tutto il resto della
  piattaforma (import, voti, statistiche, persino i sondaggi) funziona
  a posteriori via Fubles, sempre dopo che la partita è stata giocata.
  I pronostici per natura richiedono l'opposto — squadre note e un
  utente che si esprime PRIMA — il che avrebbe richiesto una tabella e
  un flusso apposta (`partite_programmate`) per un momento che nella
  pratica di questa lega non esiste mai in modo affidabile. Non vale la
  complessità per un uso che resterebbe marginale. Da riconsiderare
  solo se il flusso reale della lega cambiasse (es. squadre annunciate
  con giorni di anticipo).
- Notifiche email (§14) — le push browser sono fatte, l'email resta parcheggiata
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
