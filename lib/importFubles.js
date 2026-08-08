/* ============================================================
   SCARSI LEAGUE — parser import manuale Fubles
   Formato: testo incollato dai fogli PARTITE / PRESTAZIONI_GIOCATORI /
   VOTI_RICEVUTI dell'estrazione Fubles (tab-separated, riga di intestazione).
   Funzioni pure: nessuna chiamata a Supabase qui dentro.
   ============================================================ */

const MAPPA_RUOLO = {
  attaccante: "ATT", centrocampista: "CEN", difensore: "DIF", portiere: "POR",
};

function mappaRuolo(testo) {
  return MAPPA_RUOLO[(testo || "").trim().toLowerCase()] || null;
}

function estraiId(url, parolaChiave) {
  if (!url) return null;
  const m = url.match(new RegExp(`${parolaChiave}/(\\d+)`));
  return m ? m[1] : null;
}

function dataItalianaAIso(s) {
  const m = (s || "").trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const [, g, mese, anno] = m;
  return `${anno}-${mese.padStart(2, "0")}-${g.padStart(2, "0")}`;
}

function numeroONull(v) {
  if (v === undefined || v === null || String(v).trim() === "") return null;
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

// tollera intestazioni scritte/incollate con maiuscole o spazi diversi
// dall'originale ("Match ID" invece di "match_id"): il resto del parser
// lavora sempre sui nomi canonici (minuscolo, underscore).
function normalizzaIntestazione(h) {
  return (h || "").trim().toLowerCase().replace(/\s+/g, "_");
}

/* righe tab-separated con intestazione -> array di oggetti {colonna: valore} */
function parseTabella(testo) {
  const senzaBom = (testo || "").replace(/^﻿/, "");
  const righe = senzaBom.split(/\r?\n/).map((r) => r.replace(/\r$/, "")).filter((r) => r.trim() !== "");
  if (righe.length < 2) return { intestazioni: [], righe: [] };
  const intestazioni = righe[0].split("\t").map(normalizzaIntestazione);
  const dati = righe.slice(1).map((riga) => {
    const celle = riga.split("\t");
    const obj = {};
    intestazioni.forEach((h, i) => { if (h) obj[h] = (celle[i] ?? "").trim(); });
    return obj;
  });
  return { intestazioni, righe: dati };
}

/* ---------- parser principale ---------- */
export function parseImportFubles({ partiteText, prestazioniText, votiText, legaId }) {
  const errori = [];
  const avvisi = [];

  const partiteRaw = parseTabella(partiteText);
  const prestazioniRaw = parseTabella(prestazioniText);
  const votiRaw = parseTabella(votiText);

  if (!partiteRaw.righe.length) errori.push("Nessuna riga trovata nella tabella PARTITE (controlla di aver incollato anche l'intestazione).");
  if (!prestazioniRaw.righe.length) errori.push("Nessuna riga trovata nella tabella PRESTAZIONI_GIOCATORI.");

  const RICHIESTE_PARTITE = ["match_id", "data", "squadra_1", "squadra_2", "gol_squadra_1", "gol_squadra_2"];
  RICHIESTE_PARTITE.forEach((c) => {
    if (partiteRaw.righe.length && !(c in partiteRaw.righe[0])) errori.push(`Colonna mancante in PARTITE: ${c}`);
  });
  const RICHIESTE_PRESTAZIONI = ["match_id", "giocatore", "profilo_fubles", "squadra", "ruolo"];
  RICHIESTE_PRESTAZIONI.forEach((c) => {
    if (prestazioniRaw.righe.length && !(c in prestazioniRaw.righe[0])) errori.push(`Colonna mancante in PRESTAZIONI_GIOCATORI: ${c}`);
  });

  if (errori.length) return { errori, avvisi, partite: [], giocatoriNuovi: [], prestazioni: [], voti: [] };

  // match_id duplicati DENTRO lo stesso incolla: bloccante, altrimenti la
  // scrittura in tabella (match_id è unique) fallirebbe a metà import.
  const contaMatchId = {};
  partiteRaw.righe.forEach((r) => { contaMatchId[r.match_id] = (contaMatchId[r.match_id] || 0) + 1; });
  const duplicati = Object.entries(contaMatchId).filter(([, n]) => n > 1).map(([id]) => id);
  if (duplicati.length) {
    errori.push(`match_id ripetuto più volte in PARTITE nello stesso incolla: ${duplicati.join(", ")}`);
    return { errori, avvisi, partite: [], giocatoriNuovi: [], prestazioni: [], voti: [] };
  }

  const partite = partiteRaw.righe.map((r) => ({
    match_id: r.match_id,
    fubles_match_id: estraiId(r.fubles_url, "matches"),
    fubles_url: r.fubles_url || null,
    data: dataItalianaAIso(r.data) || r.data,
    ora: r.ora || null,
    disciplina: r.disciplina || null,
    coperto_scoperto: r.coperto_scoperto || null,
    struttura: r.struttura || null,
    indirizzo: r.indirizzo || null,
    organizzatore: r.organizzatore || null,
    squadra_1: r.squadra_1,
    squadra_2: r.squadra_2,
    gol_squadra_1: numeroONull(r.gol_squadra_1) ?? 0,
    gol_squadra_2: numeroONull(r.gol_squadra_2) ?? 0,
    forza_squadra_1: numeroONull(r.forza_squadra_1),
    forza_squadra_2: numeroONull(r.forza_squadra_2),
    stato: r.stato || null,
    pubblica_privata: r.pubblica_privata || null,
    lega_id: legaId,
  }));

  // nome -> fubles_user_id, per risolvere i voti (che hanno solo nomi) e deduplicare i giocatori
  const nomeAFublesId = {};
  const giocatoriMap = new Map(); // fubles_user_id -> { nome, fubles_user_id, fubles_url, ruolo_prevalente, foto_disponibile }

  prestazioniRaw.righe.forEach((r) => {
    const fid = estraiId(r.profilo_fubles, "users");
    if (fid) {
      nomeAFublesId[r.giocatore] = fid;
      if (!giocatoriMap.has(fid)) {
        giocatoriMap.set(fid, {
          nome: r.giocatore,
          fubles_user_id: fid,
          fubles_url: r.profilo_fubles,
          ruolo_prevalente: mappaRuolo(r.ruolo) || "CEN",
          foto_disponibile: (r.foto_profilo || "").toLowerCase() === "disponibile",
        });
      }
    }
  });

  const prestazioni = prestazioniRaw.righe.map((r) => ({
    match_id: r.match_id,
    fubles_user_id: estraiId(r.profilo_fubles, "users"),
    squadra: r.squadra,
    ruolo: mappaRuolo(r.ruolo),
    voto: numeroONull(r.voto),
    gol: numeroONull(r.gol) ?? 0,
    motm: (r.man_of_the_match || "").trim().toLowerCase() === "si" || (r.man_of_the_match || "").trim().toLowerCase() === "sì",
    premio: r.premio || null,
    esito: r.esito || null,
    gol_squadra: numeroONull(r.gol_squadra),
    gol_subiti: numeroONull(r.gol_subiti),
    note: r.note || null,
  }));

  const prestazioniSenzaId = prestazioni.filter((p) => !p.fubles_user_id).length;
  if (prestazioniSenzaId) {
    avvisi.push(`${prestazioniSenzaId} riga/e di PRESTAZIONI_GIOCATORI senza un link profilo_fubles riconoscibile: verranno ignorate (il giocatore non può essere identificato).`);
  }

  const votiGrezzi = votiRaw.righe.map((r) => ({
    match_id: r.match_id,
    valutato_fubles_user_id: nomeAFublesId[r.giocatore_valutato] || null,
    votante_fubles_user_id: nomeAFublesId[r.votante] || null,
    voto: numeroONull(r.voto),
    commento: r.commento && r.commento.toUpperCase() !== "ND" ? r.commento : null,
  }));
  const voti = votiGrezzi.filter((v) => v.valutato_fubles_user_id && v.votante_fubles_user_id && v.voto != null);
  const votiScartati = votiGrezzi.length - voti.length;
  if (votiScartati) {
    avvisi.push(`${votiScartati} riga/e di VOTI_RICEVUTI ignorate: nome non trovato tra chi ha giocato quel match, o voto non numerico.`);
  }

  return {
    errori: [],
    avvisi,
    partite,
    giocatoriNuovi: [...giocatoriMap.values()],
    prestazioni,
    voti,
  };
}
