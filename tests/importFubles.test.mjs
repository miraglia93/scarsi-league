import { test, assert, assertEqual, riepilogo } from "./_assert.mjs";
import { parseImportFubles } from "../lib/importFubles.js";

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

export const ok = riepilogo("importFubles.test.mjs");
