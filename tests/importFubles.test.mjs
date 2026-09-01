import { test, assert, assertEqual, riepilogo } from "./_assert.mjs";
import {
  parseImportFubles, calcolaAnteprimaImport, partiteDaInserire,
  trovaGiocatoriNuovi, costruisciPrestazioni, costruisciVoti, parseImportRapido, parseImportPreMatch,
} from "../lib/importFubles.js";

console.log("importFubles.js");

/* righe vere (accorciate) dall'estrazione Fubles fornita da Alessandro */
const partiteText = [
  "match_id\tfubles_url\tdata\tora\tdisciplina\tcoperto_scoperto\tstruttura\tindirizzo\torganizzatore\tsquadra_1\tsquadra_2\tgol_squadra_1\tgol_squadra_2\tvincitore\tdifferenza_reti\ttotale_gol\tforza_squadra_1\tforza_squadra_2\tstato\tpubblica_privata",
  "2026-07-20_BETTINELLI_BIANCHI-NERI\thttps://app.fubles.com/it/app/matches/3149865\t20/07/2026\t21:00\tCalcio a 8\tCoperto\tCentro Sportivo Bettinelli\tVia Lago Di Nemi, 31, 20142 Milano\tCosimo Avantaggiato\tBianchi\tNeri\t6\t5\tBianchi\t1\t11\t72\t59\tDisputata\tPubblica",
].join("\n");

const prestazioniText = [
  "match_id\tdata\tfubles_url\tgiocatore\tprofilo_fubles\tsquadra\truolo\tvoto\tgol\tman_of_the_match\tpremio\tesito\tgol_squadra\tgol_subiti\tfoto_profilo\tnote",
  "2026-07-20_BETTINELLI_BIANCHI-NERI\t20/07/2026\thttps://app.fubles.com/it/app/matches/3149865\tLuciano Scotti\thttps://app.fubles.com/it/app/users/577876\tBianchi\tAttaccante\t7.14\t0\tNo\t\tVittoria\t6\t5\tDisponibile\t",
  "2026-07-20_BETTINELLI_BIANCHI-NERI\t20/07/2026\thttps://app.fubles.com/it/app/matches/3149865\tRoberto Faraci\thttps://app.fubles.com/it/app/users/111222\tNeri\tPortiere\t6.5\t0\tNo\t\tSconfitta\t5\t6\tDisponibile\t",
].join("\n");

const votiText = [
  "match_id\tgiocatore_valutato\tvotante\tvoto\tcommento",
  "2026-07-20_BETTINELLI_BIANCHI-NERI\tLuciano Scotti\tRoberto Faraci\t7.0\tND",
].join("\n");

let r;
test("parseImportFubles: nessun errore su un estratto valido", () => {
  r = parseImportFubles({ partiteText, prestazioniText, votiText, legaId: 1 });
  assertEqual(r.errori, []);
});

test("parsa correttamente la partita (data ISO, id numerici estratti dagli url)", () => {
  const p = r.partite[0];
  assertEqual(p.match_id, "2026-07-20_BETTINELLI_BIANCHI-NERI");
  assertEqual(p.data, "2026-07-20");
  assertEqual(p.fubles_match_id, "3149865");
  assertEqual(p.gol_squadra_1, 6);
  assertEqual(p.gol_squadra_2, 5);
  assertEqual(p.lega_id, 1);
});

test("deduplica i giocatori e mappa il ruolo sui codici ATT/CEN/DIF/POR", () => {
  assertEqual(r.giocatoriNuovi.length, 2);
  const scotti = r.giocatoriNuovi.find((g) => g.fubles_user_id === "577876");
  assertEqual(scotti.ruolo_prevalente, "ATT");
  assertEqual(scotti.nome, "Luciano Scotti");
});

test("risolve i voti dal nome all'id fubles tramite le prestazioni dello stesso match", () => {
  assertEqual(r.voti.length, 1);
  assertEqual(r.voti[0].valutato_fubles_user_id, "577876");
  assertEqual(r.voti[0].votante_fubles_user_id, "111222");
  assertEqual(r.voti[0].voto, 7);
});

test("il commento \"ND\" viene trattato come assente", () => {
  assertEqual(r.voti[0].commento, null);
});

test("un voto su un nome che non gioca quella partita viene scartato, non inventato", () => {
  const conNomeSconosciuto = votiText + "\n2026-07-20_BETTINELLI_BIANCHI-NERI\tGiocatore Fantasma\tRoberto Faraci\t6\tND";
  const r2 = parseImportFubles({ partiteText, prestazioniText, votiText: conNomeSconosciuto, legaId: 1 });
  assertEqual(r2.voti.length, 1); // la riga con "Giocatore Fantasma" viene ignorata, non genera un id inventato
});

test("segnala un errore chiaro se manca la colonna match_id in PARTITE", () => {
  const partiteRotto = partiteText.replace("match_id\t", "");
  const r3 = parseImportFubles({ partiteText: partiteRotto, prestazioniText, votiText: "", legaId: 1 });
  assert(r3.errori.some((e) => e.includes("match_id")), "l'errore dovrebbe citare la colonna mancante");
});

test("VOTI_RICEVUTI vuoto è accettato (è opzionale)", () => {
  const r4 = parseImportFubles({ partiteText, prestazioniText, votiText: "", legaId: 1 });
  assertEqual(r4.errori, []);
  assertEqual(r4.voti, []);
});

test("blocca (non importa a metà) se lo stesso match_id compare due volte in PARTITE", () => {
  const partiteConDuplicato = partiteText + "\n" + partiteText.split("\n")[1];
  const r5 = parseImportFubles({ partiteText: partiteConDuplicato, prestazioniText, votiText, legaId: 1 });
  assert(r5.errori.length > 0, "un match_id duplicato nello stesso incolla deve dare errore");
  assertEqual(r5.partite, []);
});

test("intestazioni con maiuscole/spazi diversi vengono riconosciute lo stesso", () => {
  const partiteMaiuscolo = partiteText.replace("match_id\t", "Match ID\t").replace("squadra_1\t", "Squadra_1\t");
  const r6 = parseImportFubles({ partiteText: partiteMaiuscolo, prestazioniText, votiText, legaId: 1 });
  assertEqual(r6.errori, []);
  assertEqual(r6.partite[0].match_id, "2026-07-20_BETTINELLI_BIANCHI-NERI");
});

test("avvisa (senza bloccare) se una riga di PRESTAZIONI_GIOCATORI non ha un profilo_fubles valido", () => {
  const prestazioniConRigaRotta = prestazioniText + "\n2026-07-20_BETTINELLI_BIANCHI-NERI\t20/07/2026\thttps://app.fubles.com/it/app/matches/3149865\tSenza Link\t\tBianchi\tDifensore\t6\t0\tNo\t\tVittoria\t6\t5\tNON DISPONIBILE\t";
  const r7 = parseImportFubles({ partiteText, prestazioniText: prestazioniConRigaRotta, votiText, legaId: 1 });
  assertEqual(r7.errori, []);
  assert(r7.avvisi.some((a) => a.includes("PRESTAZIONI_GIOCATORI")), "dovrebbe avvisare della riga senza profilo_fubles");
});

// ---------- confronto col database (usato da analizzaImport/confermaImport in admin) ----------

test("calcolaAnteprimaImport: match_id già in lega -> partita e dati collegati esclusi dai conteggi", () => {
  const giaEsistenti = [{ match_id: "2026-07-20_BETTINELLI_BIANCHI-NERI" }];
  const anteprima = calcolaAnteprimaImport(r, giaEsistenti, []);
  assertEqual(anteprima.nuoveMatchIds.size, 0);
  assertEqual(anteprima.nPartiteEsistenti, 1);
  assertEqual(anteprima.nPrestazioni, 0);
  assertEqual(anteprima.nVoti, 0);
});

test("calcolaAnteprimaImport: match_id nuovo, giocatore già in lega -> non riconta il giocatore", () => {
  const giocatoriEsistenti = [{ fubles_user_id: "577876" }]; // Luciano Scotti già in lega
  const anteprima = calcolaAnteprimaImport(r, [], giocatoriEsistenti);
  assertEqual(anteprima.nuoveMatchIds.size, 1);
  assertEqual(anteprima.nGiocatoriNuovi, 1); // resta Roberto Faraci
  assertEqual(anteprima.nPrestazioni, 2);
});

test("partiteDaInserire + trovaGiocatoriNuovi + costruisciPrestazioni/Voti: round-trip completo", () => {
  const anteprima = calcolaAnteprimaImport(r, [], []);
  const daInserire = partiteDaInserire(r, anteprima.nuoveMatchIds);
  assertEqual(daInserire.length, 1);

  const nuoviGiocatori = trovaGiocatoriNuovi(r, []);
  assertEqual(nuoviGiocatori.length, 2);

  // simula gli id assegnati dal database dopo l'insert
  const matchIdAId = { [daInserire[0].match_id]: 501 };
  const fublesIdAId = {};
  nuoviGiocatori.forEach((g, i) => { fublesIdAId[g.fubles_user_id] = 900 + i; });

  const prestazioni = costruisciPrestazioni(r, anteprima.nuoveMatchIds, matchIdAId, fublesIdAId);
  assertEqual(prestazioni.length, 2);
  assert(prestazioni.every((p) => p.partita_id === 501), "tutte le prestazioni devono puntare alla partita appena creata");

  const voti = costruisciVoti(r, anteprima.nuoveMatchIds, matchIdAId, fublesIdAId);
  assertEqual(voti.length, 1);
  assertEqual(voti[0].partita_id, 501);
});

test("costruisciPrestazioni: scarta le righe di un match che non è stato inserito (già esistente)", () => {
  const nuoveMatchIds = new Set(); // nessun match nuovo, come se fosse già tutto presente
  const prestazioni = costruisciPrestazioni(r, nuoveMatchIds, {}, {});
  assertEqual(prestazioni.length, 0);
});

/* ---------- import rapido (bookmarklet, senza id Fubles) ---------- */

const datiRapido = {
  match_id: "3149177",
  fubles_url: "https://app.fubles.com/it/app/matches/3149177",
  data: "2026-07-13",
  ora: "21:00",
  disciplina: "Calcio a 8",
  coperto_scoperto: "Coperto",
  struttura: "Centro Sportivo Bettinelli",
  indirizzo: "Via Lago Di nemi, 31 20142 Milano",
  pubblica_privata: "Pubblica",
  squadra_1: "Bianchi",
  squadra_2: "Neri",
  gol_squadra_1: 5,
  gol_squadra_2: 7,
  giocatori: [
    {
      nome: "Fabio Parlato", ruolo: "Difensore", squadra: "Bianchi", voto: 6.7, gol: 0, mvp: true,
      voti_ricevuti: [{ votante: "Mauro Merlotti", voto: 7 }, { votante: "Nome Sconosciuto", voto: 5 }],
    },
    { nome: "Mauro Merlotti", ruolo: "Portiere", squadra: "Neri", voto: 6.63, gol: 0, mvp: false, voti_ricevuti: [] },
  ],
};

test("parseImportRapido: nessun errore su dati validi", () => {
  const r2 = parseImportRapido(datiRapido, { legaId: 1, partiteEsistenti: [], giocatoriEsistenti: [] });
  assertEqual(r2.errori, []);
  assertEqual(r2.partita.match_id, "3149177");
  assertEqual(r2.partita.gol_squadra_1, 5);
  assertEqual(r2.partita.lega_id, 1);
});

test("parseImportRapido: blocca se il match_id è già stato importato in questa lega", () => {
  const r2 = parseImportRapido(datiRapido, { legaId: 1, partiteEsistenti: [{ match_id: "3149177" }], giocatoriEsistenti: [] });
  assert(r2.errori.length > 0, "deve segnalare un errore");
  assertEqual(r2.partita, null);
});

test("parseImportRapido: identifica i giocatori per nome, non per id Fubles", () => {
  const r2 = parseImportRapido(datiRapido, {
    legaId: 1, partiteEsistenti: [],
    giocatoriEsistenti: [{ id: 42, nome: "Fabio Parlato" }], // già in lega -> non è "nuovo"
  });
  assertEqual(r2.giocatoriNuovi.length, 1);
  assertEqual(r2.giocatoriNuovi[0].nome, "Mauro Merlotti");
  assertEqual(r2.giocatoriNuovi[0].ruolo_prevalente, "POR");
});

test("parseImportRapido: calcola esito, gol_squadra e gol_subiti dalla squadra e dal punteggio", () => {
  const r2 = parseImportRapido(datiRapido, { legaId: 1, partiteEsistenti: [], giocatoriEsistenti: [] });
  const parlato = r2.prestazioni.find((p) => p.nome === "Fabio Parlato");
  assertEqual(parlato.esito, "Sconfitta"); // Bianchi 5 - Neri 7
  assertEqual(parlato.gol_squadra, 5);
  assertEqual(parlato.gol_subiti, 7);
  assertEqual(parlato.motm, true);
  const merlotti = r2.prestazioni.find((p) => p.nome === "Mauro Merlotti");
  assertEqual(merlotti.esito, "Vittoria");
});

test("parseImportRapido: scarta un voto il cui votante non ha giocato la partita", () => {
  const r2 = parseImportRapido(datiRapido, { legaId: 1, partiteEsistenti: [], giocatoriEsistenti: [] });
  assertEqual(r2.voti.length, 1);
  assertEqual(r2.voti[0].votante_nome, "Mauro Merlotti");
  assert(r2.avvisi.some((a) => a.includes("1 voto")), "deve avvisare del voto scartato");
});

const datiPreMatch = {
  match_id: "3152683",
  fubles_url: "https://app.fubles.com/it/app/matches/3152683",
  data: "2026-09-08",
  ora: "19:00",
  squadra_1: "Bianchi",
  squadra_2: "Neri",
  forza_squadra_1: 74,
  forza_squadra_2: 65,
  giocatori: [
    { nome: "Fabio Parlato", ruolo: "Difensore", squadra: "Bianchi" },
    { nome: "Mauro Merlotti", ruolo: "Portiere", squadra: "Neri" },
  ],
};

test("parseImportPreMatch: nessun errore, gol_squadra_1/2 sono null (nessun risultato ancora)", () => {
  const r = parseImportPreMatch(datiPreMatch, { legaId: 1, partiteEsistenti: [], giocatoriEsistenti: [] });
  assertEqual(r.errori, []);
  assertEqual(r.partita.match_id, "3152683");
  assertEqual(r.partita.gol_squadra_1, null);
  assertEqual(r.partita.gol_squadra_2, null);
  assertEqual(r.partita.stato_live, "programmata");
  assertEqual(r.partita.forza_squadra_1, 74);
});

test("parseImportPreMatch: le prestazioni non hanno voto né gol (la partita non è ancora giocata)", () => {
  const r = parseImportPreMatch(datiPreMatch, { legaId: 1, partiteEsistenti: [], giocatoriEsistenti: [] });
  assertEqual(r.prestazioni.length, 2);
  r.prestazioni.forEach((p) => {
    assertEqual(p.voto, null);
    assertEqual(p.gol, 0);
    assertEqual(p.motm, false);
  });
});

test("parseImportPreMatch: blocca se il match_id è già stato importato in questa lega", () => {
  const r = parseImportPreMatch(datiPreMatch, { legaId: 1, partiteEsistenti: [{ match_id: "3152683" }], giocatoriEsistenti: [] });
  assert(r.errori.length > 0, "deve segnalare un errore");
  assertEqual(r.partita, null);
});

export const ok = riepilogo("importFubles.test.mjs");
