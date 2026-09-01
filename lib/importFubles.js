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

/* ---------- confronto col database, prima di scrivere (usato per l'anteprima e la conferma) ---------- */

// quali match_id del parser non esistono ancora tra le partite già in lega
export function trovaMatchIdNuovi(parsed, partiteEsistenti) {
  const esistenti = new Set(partiteEsistenti.map((p) => p.match_id));
  return new Set(parsed.partite.filter((p) => !esistenti.has(p.match_id)).map((p) => p.match_id));
}

// quali giocatori del parser non hanno ancora un fubles_user_id in lega
export function trovaGiocatoriNuovi(parsed, giocatoriEsistenti) {
  const esistenti = new Set(giocatoriEsistenti.map((g) => g.fubles_user_id).filter(Boolean));
  return parsed.giocatoriNuovi.filter((g) => !esistenti.has(g.fubles_user_id));
}

// conteggi per l'anteprima mostrata all'admin prima di confermare
export function calcolaAnteprimaImport(parsed, partiteEsistenti, giocatoriEsistenti) {
  const nuoveMatchIds = trovaMatchIdNuovi(parsed, partiteEsistenti);
  return {
    nuoveMatchIds,
    nPartiteEsistenti: parsed.partite.length - nuoveMatchIds.size,
    nGiocatoriNuovi: trovaGiocatoriNuovi(parsed, giocatoriEsistenti).length,
    nPrestazioni: parsed.prestazioni.filter((p) => nuoveMatchIds.has(p.match_id)).length,
    nVoti: parsed.voti.filter((v) => nuoveMatchIds.has(v.match_id)).length,
  };
}

// righe di partite da inserire davvero (solo i match_id nuovi)
export function partiteDaInserire(parsed, nuoveMatchIds) {
  return parsed.partite.filter((p) => nuoveMatchIds.has(p.match_id));
}

// payload prestazioni, risolti sugli id reali (db) di partita e giocatore
// noti solo DOPO aver inserito le partite/giocatori nuovi
export function costruisciPrestazioni(parsed, nuoveMatchIds, matchIdAId, fublesIdAId) {
  return parsed.prestazioni
    .filter((p) => nuoveMatchIds.has(p.match_id) && matchIdAId[p.match_id] && fublesIdAId[p.fubles_user_id])
    .map((p) => ({
      partita_id: matchIdAId[p.match_id], giocatore_id: fublesIdAId[p.fubles_user_id],
      squadra: p.squadra, ruolo: p.ruolo, voto: p.voto, gol: p.gol, motm: p.motm,
      premio: p.premio, esito: p.esito, gol_squadra: p.gol_squadra, gol_subiti: p.gol_subiti, note: p.note,
    }));
}

// payload voti, stesso principio dei prestazioni
export function costruisciVoti(parsed, nuoveMatchIds, matchIdAId, fublesIdAId) {
  return parsed.voti
    .filter((v) => nuoveMatchIds.has(v.match_id) && matchIdAId[v.match_id] && fublesIdAId[v.valutato_fubles_user_id] && fublesIdAId[v.votante_fubles_user_id])
    .map((v) => ({
      partita_id: matchIdAId[v.match_id], valutato_id: fublesIdAId[v.valutato_fubles_user_id],
      votante_id: fublesIdAId[v.votante_fubles_user_id], voto: v.voto, commento: v.commento,
    }));
}

/* ============================================================
   IMPORT RAPIDO (bookmarklet): una partita alla volta, incollando il
   JSON che il bottone "Importa da Fubles" produce leggendo la pagina
   partita già aperta dall'admin. A differenza dell'import manuale
   sopra, qui NON c'è un link al profilo Fubles di ogni giocatore (non
   è leggibile dalla pagina senza aprire 16 profili uno per uno, cosa
   che assomiglierebbe troppo a uno scraping automatico) — i giocatori
   sono quindi identificati per NOME all'interno della lega, non per
   fubles_user_id. Stesso principio "mai scrivere senza anteprima".
   ============================================================ */

const chiaveNome = (nome) => (nome || "").trim().toLowerCase();

// valida la forma dei dati incollati (un oggetto JSON, non testo tabellare)
export function parseImportRapido(dati, { legaId, partiteEsistenti, giocatoriEsistenti }) {
  const errori = [];
  const avvisi = [];

  if (!dati || typeof dati !== "object" || !dati.match_id) {
    errori.push("Dati non riconosciuti: incolla esattamente quello che il bottone \"Importa da Fubles\" ha copiato.");
    return { errori, avvisi, partita: null, giocatoriNuovi: [], prestazioni: [], voti: [] };
  }
  if (!dati.squadra_1 || !dati.squadra_2 || !dati.data) {
    errori.push("Mancano dati essenziali della partita (squadre o data) — riprova dal bottone sulla pagina Fubles.");
    return { errori, avvisi, partita: null, giocatoriNuovi: [], prestazioni: [], voti: [] };
  }
  if (!Array.isArray(dati.giocatori) || !dati.giocatori.length) {
    errori.push("Nessun giocatore trovato nei dati incollati.");
    return { errori, avvisi, partita: null, giocatoriNuovi: [], prestazioni: [], voti: [] };
  }
  if ((partiteEsistenti || []).some((p) => p.match_id === String(dati.match_id))) {
    errori.push(`Questa partita (match_id ${dati.match_id}) risulta già importata in questa lega.`);
    return { errori, avvisi, partita: null, giocatoriNuovi: [], prestazioni: [], voti: [] };
  }

  const partita = {
    match_id: String(dati.match_id),
    fubles_url: dati.fubles_url || null,
    data: dati.data,
    ora: dati.ora || null,
    disciplina: dati.disciplina || null,
    coperto_scoperto: dati.coperto_scoperto || null,
    struttura: dati.struttura || null,
    indirizzo: dati.indirizzo || null,
    pubblica_privata: dati.pubblica_privata || null,
    squadra_1: dati.squadra_1,
    squadra_2: dati.squadra_2,
    gol_squadra_1: numeroONull(dati.gol_squadra_1) ?? 0,
    gol_squadra_2: numeroONull(dati.gol_squadra_2) ?? 0,
    lega_id: legaId,
  };

  const esistenti = new Map((giocatoriEsistenti || []).map((g) => [chiaveNome(g.nome), g]));
  const giocatoriNuovi = [];
  const visti = new Set();
  dati.giocatori.forEach((g) => {
    const chiave = chiaveNome(g.nome);
    if (!chiave || visti.has(chiave)) return;
    visti.add(chiave);
    if (!esistenti.has(chiave)) {
      giocatoriNuovi.push({ nome: (g.nome || "").trim(), ruolo_prevalente: mappaRuolo(g.ruolo) || "CEN" });
    }
  });

  const esito = (squadra) => {
    const propri = squadra === partita.squadra_1 ? partita.gol_squadra_1 : partita.gol_squadra_2;
    const avversari = squadra === partita.squadra_1 ? partita.gol_squadra_2 : partita.gol_squadra_1;
    return propri > avversari ? "Vittoria" : propri < avversari ? "Sconfitta" : "Pareggio";
  };

  const prestazioni = dati.giocatori
    .filter((g) => chiaveNome(g.nome))
    .map((g) => ({
      nome: g.nome.trim(),
      squadra: g.squadra || null,
      ruolo: mappaRuolo(g.ruolo),
      voto: numeroONull(g.voto),
      gol: numeroONull(g.gol) ?? 0,
      motm: !!g.mvp,
      esito: g.squadra ? esito(g.squadra) : null,
      gol_squadra: g.squadra === partita.squadra_1 ? partita.gol_squadra_1 : g.squadra === partita.squadra_2 ? partita.gol_squadra_2 : null,
      gol_subiti: g.squadra === partita.squadra_1 ? partita.gol_squadra_2 : g.squadra === partita.squadra_2 ? partita.gol_squadra_1 : null,
    }));

  const nomiInPartita = new Set(prestazioni.map((p) => chiaveNome(p.nome)));
  const voti = [];
  let votiScartati = 0;
  dati.giocatori.forEach((g) => {
    (g.voti_ricevuti || []).forEach((v) => {
      const votanteChiave = chiaveNome(v.votante);
      const votoNum = numeroONull(v.voto);
      if (votanteChiave && nomiInPartita.has(votanteChiave) && votoNum != null) {
        voti.push({ valutato_nome: g.nome.trim(), votante_nome: v.votante.trim(), voto: votoNum });
      } else {
        votiScartati++;
      }
    });
  });
  if (votiScartati) {
    avvisi.push(`${votiScartati} voto/i ignorati: votante non trovato tra chi ha giocato questa partita.`);
  }

  return { errori: [], avvisi, partita, giocatoriNuovi, prestazioni, voti };
}

/* ============================================================
   IMPORT PRE-PARTITA (bookmarklet): stesso principio dell'import
   rapido, ma letto dalla tab "FORMAZIONI" di Fubles PRIMA che la
   partita sia giocata — niente voti, gol o MVP (non esistono ancora),
   niente calcolo di esito (nessun risultato su cui basarlo). Serve ad
   agganciare in anticipo un `match_id` per il live match; l'import
   post-partita di sempre (parseImportRapido) potrà girare più tardi
   sullo stesso match_id senza toccare i dati che il cronista avrà
   scritto nel frattempo in dati_manuali.
   ============================================================ */
export function parseImportPreMatch(dati, { legaId, partiteEsistenti, giocatoriEsistenti }) {
  const errori = [];
  const avvisi = [];

  if (!dati || typeof dati !== "object" || !dati.match_id) {
    errori.push("Dati non riconosciuti: incolla esattamente quello che il bottone ha copiato.");
    return { errori, avvisi, partita: null, giocatoriNuovi: [], prestazioni: [] };
  }
  if (!dati.squadra_1 || !dati.squadra_2 || !dati.data) {
    errori.push("Mancano dati essenziali della partita (squadre o data) — riprova dal bottone sulla pagina Fubles.");
    return { errori, avvisi, partita: null, giocatoriNuovi: [], prestazioni: [] };
  }
  if (!Array.isArray(dati.giocatori) || !dati.giocatori.length) {
    errori.push("Nessun giocatore trovato nella formazione.");
    return { errori, avvisi, partita: null, giocatoriNuovi: [], prestazioni: [] };
  }
  if ((partiteEsistenti || []).some((p) => p.match_id === String(dati.match_id))) {
    errori.push(`Questa partita (match_id ${dati.match_id}) risulta già importata in questa lega.`);
    return { errori, avvisi, partita: null, giocatoriNuovi: [], prestazioni: [] };
  }

  const partita = {
    match_id: String(dati.match_id),
    fubles_url: dati.fubles_url || null,
    data: dati.data,
    ora: dati.ora || null,
    disciplina: dati.disciplina || null,
    coperto_scoperto: dati.coperto_scoperto || null,
    struttura: dati.struttura || null,
    indirizzo: dati.indirizzo || null,
    pubblica_privata: dati.pubblica_privata || null,
    squadra_1: dati.squadra_1,
    squadra_2: dati.squadra_2,
    gol_squadra_1: null,
    gol_squadra_2: null,
    forza_squadra_1: numeroONull(dati.forza_squadra_1),
    forza_squadra_2: numeroONull(dati.forza_squadra_2),
    stato_live: "programmata",
    lega_id: legaId,
  };

  const esistenti = new Map((giocatoriEsistenti || []).map((g) => [chiaveNome(g.nome), g]));
  const giocatoriNuovi = [];
  const visti = new Set();
  dati.giocatori.forEach((g) => {
    const chiave = chiaveNome(g.nome);
    if (!chiave || visti.has(chiave)) return;
    visti.add(chiave);
    if (!esistenti.has(chiave)) {
      giocatoriNuovi.push({ nome: (g.nome || "").trim(), ruolo_prevalente: mappaRuolo(g.ruolo) || "CEN" });
    }
  });

  const prestazioni = dati.giocatori
    .filter((g) => chiaveNome(g.nome))
    .map((g) => ({
      nome: g.nome.trim(),
      squadra: g.squadra || null,
      ruolo: mappaRuolo(g.ruolo),
      voto: null,
      gol: 0,
      motm: false,
    }));

  return { errori: [], avvisi, partita, giocatoriNuovi, prestazioni };
}
