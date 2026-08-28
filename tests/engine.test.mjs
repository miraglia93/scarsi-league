import { test, assert, assertEqual, assertVicino, riepilogo } from "./_assert.mjs";
import {
  assemble, buildStats, computeXP, computeLivello, computeBadges, buildTOTW, tradErroreDb, cardStats,
  applicaNomiRegistrati, applicaGolManuali,
} from "../lib/engine.js";

/* dataset sintetico: 4 giocatori, 2 partite, coerente con le forme delle
   righe che arrivano davvero da Supabase (stessi nomi di colonna) */
const giocatori = [
  { id: 1, nome: "Mario", nickname: null, foto_url: null, numero_maglia: 9, ruolo_prevalente: "ATT" },
  { id: 2, nome: "Luigi", nickname: null, foto_url: null, numero_maglia: 10, ruolo_prevalente: "CEN" },
  { id: 3, nome: "Peach", nickname: null, foto_url: null, numero_maglia: 3, ruolo_prevalente: "DIF" },
  { id: 4, nome: "Bowser", nickname: null, foto_url: null, numero_maglia: 1, ruolo_prevalente: "POR" },
];

const partite = [
  { id: 101, match_id: "m1", data: "2026-01-05", squadra_1: "Rossi", squadra_2: "Blu", gol_squadra_1: 3, gol_squadra_2: 1, forza_squadra_1: 60, forza_squadra_2: 55 },
  { id: 102, match_id: "m2", data: "2026-01-12", squadra_1: "Rossi", squadra_2: "Blu", gol_squadra_1: 2, gol_squadra_2: 2, forza_squadra_1: 58, forza_squadra_2: 58 },
];

const prestazioni = [
  { partita_id: 101, giocatore_id: 1, squadra: "Rossi", voto: 8, gol: 2, ruolo: "ATT", motm: true },
  { partita_id: 101, giocatore_id: 2, squadra: "Rossi", voto: 7, gol: 1, ruolo: "CEN", motm: false },
  { partita_id: 101, giocatore_id: 3, squadra: "Blu", voto: 6, gol: 0, ruolo: "DIF", motm: false },
  { partita_id: 101, giocatore_id: 4, squadra: "Blu", voto: 5, gol: 0, ruolo: "POR", motm: false },
  { partita_id: 102, giocatore_id: 1, squadra: "Rossi", voto: 7, gol: 1, ruolo: "ATT", motm: false },
  { partita_id: 102, giocatore_id: 2, squadra: "Blu", voto: 6.5, gol: 0, ruolo: "CEN", motm: false },
  { partita_id: 102, giocatore_id: 3, squadra: "Rossi", voto: 7.5, gol: 0, ruolo: "DIF", motm: false },
  { partita_id: 102, giocatore_id: 4, squadra: "Blu", voto: 6, gol: 0, ruolo: "POR", motm: true },
];

const voti = [
  { partita_id: 101, valutato_id: 1, votante_id: 2, voto: 7, anomalo: false },
  { partita_id: 101, valutato_id: 1, votante_id: 3, voto: 9, anomalo: true }, // deve essere escluso
  { partita_id: 102, valutato_id: 1, votante_id: 3, voto: 8, anomalo: false },
];

console.log("engine.js");

let data, S;
test("assemble: costruisce le partite in ordine cronologico", () => {
  data = assemble(partite, giocatori, prestazioni, voti);
  assertEqual(data.matches.map((m) => m.id), ["m1", "m2"]);
});

test("assemble: assegna l'MVP dalla riga con motm=true", () => {
  assertEqual(data.matches[0].mvp, 1);
  assertEqual(data.matches[1].mvp, 4);
});

test("assemble: esclude i voti anomali", () => {
  assertEqual(data.votes.length, 2);
});

test("buildStats: presenze, vittorie/pareggi, gol e punti di Mario", () => {
  S = buildStats(data.P, data.matches);
  const mario = S[1];
  assertEqual(mario.presenze, 2);
  assertEqual(mario.w, 1);
  assertEqual(mario.d, 1);
  assertEqual(mario.l, 0);
  assertEqual(mario.gol, 3);
  assertEqual(mario.punti, 4); // 1 vittoria (3) + 1 pareggio (1)
  assertVicino(mario.mediaVoto, 7.5, 0.001);
});

test("buildStats: overall resta dentro i limiti 55-96", () => {
  Object.values(S).forEach((p) => {
    assert(p.overall >= 55 && p.overall <= 96, `overall ${p.overall} fuori range per id ${p.id}`);
  });
});

test("computeXP: totale coerente con la ripartizione dichiarata", () => {
  const { totale, ripartizione } = computeXP(S[1], {});
  const somma = Object.values(ripartizione).reduce((a, b) => a + b, 0);
  assertEqual(totale, somma);
  assertEqual(totale, 124); // 20 presenze + 23 risultati + 36 gol + 25 mvp + 20 voto alto
});

test("computeLivello: sotto 150 XP è ancora Esordiente, prossimo Amatore", () => {
  const l = computeLivello(124);
  assertEqual(l.nome, "Esordiente");
  assertEqual(l.prossimoNome, "Amatore");
  assert(l.progresso > 0 && l.progresso < 1);
});

test("computeLivello: esattamente alla soglia sale di livello", () => {
  const l = computeLivello(150);
  assertEqual(l.nome, "Amatore");
});

test("computeBadges: soglie presenze/gol/mvp e Saracinesca per i portieri", () => {
  const s = { id: 1, presenze: 5, gol: 10, mvp: 3, ruolo: "POR", forma: ["W", "W", "W", "W", "L"] };
  const badges = computeBadges(s, []);
  const ids = badges.map((b) => b.id);
  assert(ids.includes("presenze"), "manca il badge presenze");
  assert(ids.includes("gol"), "manca il badge gol");
  assert(ids.includes("mvp"), "manca il badge mvp");
  assert(ids.includes("serie"), "manca il badge serie (4 vittorie di fila)");
  assert(ids.includes("saracinesca"), "manca il badge saracinesca per un portiere con 3+ presenze");
});

test("buildTOTW: con soli 4 giocatori la 1-3-3-1 va adattata", () => {
  const totw = buildTOTW(data.matches[0], data.P);
  assertEqual(totw.disponibili, 4);
  assert(totw.adattata, "con 4 giocatori per 8 posti la formazione deve risultare adattata");
});

test("cardStats: solo dati reali, nessun attributo inventato (velocità, tiro...)", () => {
  const stats = cardStats(S[1]); // Mario
  const chiavi = stats.map(([k]) => k);
  assertEqual(chiavi, ["PRES", "GOL", "VOTO", "MVP", "WIN%", "PT"]);
  const valori = Object.fromEntries(stats);
  assertEqual(valori.PRES, 2);
  assertEqual(valori.GOL, 3);
  assertEqual(valori.MVP, 1);
  assertEqual(valori.PT, 4);
});

test("tradErroreDb: messaggi Postgres noti tradotti in italiano", () => {
  assertEqual(tradErroreDb("duplicate key value violates unique constraint"), "Questo elemento esiste già.");
  assertEqual(tradErroreDb("permission denied for table giocatori"), "Non hai i permessi per questa operazione.");
});

test("tradErroreDb: messaggio sconosciuto passa invariato", () => {
  assertEqual(tradErroreDb("qualcosa di mai visto"), "qualcosa di mai visto");
});

test("applicaNomiRegistrati: sostituisce il nome solo per chi ha una scheda rivendicata", () => {
  const risultato = applicaNomiRegistrati(giocatori, { 1: "Mario Rossi" });
  assertEqual(risultato.find((g) => g.id === 1).nome, "Mario Rossi");
  assertEqual(risultato.find((g) => g.id === 2).nome, "Luigi");
  assertEqual(risultato.find((g) => g.id === 1).nickname, null, "gli altri campi non devono cambiare");
});

test("applicaNomiRegistrati: mappa vuota lascia i nomi già ben capitalizzati invariati", () => {
  assertEqual(applicaNomiRegistrati(giocatori, {}), giocatori);
});

test("applicaNomiRegistrati: normalizza a Title Case i nomi Fubles scritti minuscoli o maiuscoli", () => {
  const sporchi = [
    { id: 9, nome: "simone campagna", nickname: null },
    { id: 10, nome: "MARCO DE ROSSI", nickname: null },
  ];
  const risultato = applicaNomiRegistrati(sporchi, {});
  assertEqual(risultato.find((g) => g.id === 9).nome, "Simone Campagna");
  assertEqual(risultato.find((g) => g.id === 10).nome, "Marco De Rossi");
});

test("applicaNomiRegistrati: rietichetta i placeholder di account Fubles cancellati", () => {
  const risultato = applicaNomiRegistrati([{ id: 11, nome: "Disabled User", nickname: null }], {});
  assertEqual(risultato[0].nome, "Giocatore Fubles");
});

test("applicaGolManuali: la correzione manuale del capitano sostituisce il gol Fubles", () => {
  const prestazioni = [
    { partita_id: 1, giocatore_id: 1, gol: 2 },
    { partita_id: 1, giocatore_id: 2, gol: 0 },
  ];
  const datiManuali = [{ partita_id: 1, giocatore_id: 1, gol_manuale: 3 }];
  const risultato = applicaGolManuali(prestazioni, datiManuali);
  assertEqual(risultato.find((r) => r.giocatore_id === 1).gol, 3);
  assertEqual(risultato.find((r) => r.giocatore_id === 2).gol, 0, "un giocatore senza correzione resta invariato");
});

test("applicaGolManuali: nessuna correzione manuale lascia le prestazioni invariate", () => {
  const prestazioni = [{ partita_id: 1, giocatore_id: 1, gol: 2 }];
  assertEqual(applicaGolManuali(prestazioni, []), prestazioni);
  assertEqual(applicaGolManuali(prestazioni, [{ partita_id: 1, giocatore_id: 1, gol_manuale: null }]), prestazioni);
});

export const ok = riepilogo("engine.test.mjs");
