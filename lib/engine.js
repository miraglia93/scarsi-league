/* ============================================================
   SCARSI LEAGUE — motore statistiche (estratto da app/page.jsx in v0.9)
   ============================================================ */

export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const MIN_REL = 2;
const MESI = ["Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago", "Set", "Ott", "Nov", "Dic"];

export const fmtData = (iso, { year = false } = {}) => {
  const d = new Date(iso + "T00:00:00");
  return `${d.getDate()} ${MESI[d.getMonth()]}${year ? ` ${d.getFullYear()}` : ""}`;
};

export const iniziali = (nome) => (nome || "?").split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();

// un account Fubles cancellato/disattivato arriva con un nome placeholder
// invece del nome vero — mostrarlo così com'è (es. "Disabled User") in una
// grafica pensata per essere condivisa sembra un bug dell'app, non un dato
// mancante: qui viene rietichettato in modo esplicito.
const PLACEHOLDER_FUBLES = /^(disabled user|deleted user|utente eliminato|unknown( player)?)$/i;

// il nome su Fubles arriva capitalizzato come l'ha scritto il singolo
// giocatore in fase di iscrizione (tutto minuscolo, tutto maiuscolo, ecc.):
// qui si normalizza a Title Case per coerenza nelle classifiche/carte.
// Il nickname, scelto dall'utente, non viene mai toccato.
const capitalizzaNome = (nome) => {
  const pulito = (nome || "").trim();
  if (PLACEHOLDER_FUBLES.test(pulito)) return "Giocatore Fubles";
  return pulito.toLowerCase().replace(/(^|[\s'-])\p{L}/gu, (c) => c.toUpperCase());
};

// sostituisce il nome Fubles con quello di registrazione per i giocatori
// la cui scheda è stata rivendicata (mappa giocatore_id -> nome_completo,
// dalla RPC nomi_registrati). Il nickname resta comunque la priorità più
// alta ovunque venga letto con "nick || nome" — qui tocchiamo solo il
// fallback.
export function applicaNomiRegistrati(giocatori, mappa) {
  return giocatori.map((g) => ({
    ...g,
    nome: capitalizzaNome(mappa?.[g.id] || g.nome),
  }));
}

// sostituisce prestazioni.gol con dati_manuali.gol_manuale quando presente:
// prestazioni.gol arriva da Fubles e viene sovrascritto a ogni re-import,
// quindi una correzione di un capitano non può vivere lì — vive in
// dati_manuali (mai toccata dall'import) e le classifiche la preferiscono
// al dato Fubles ogni volta che assemble()/buildStats() leggono i gol.
export function applicaGolManuali(prestazioni, datiManuali) {
  if (!datiManuali?.length) return prestazioni;
  const correzioni = {};
  datiManuali.forEach((d) => {
    if (d.gol_manuale != null) correzioni[`${d.partita_id}_${d.giocatore_id}`] = d.gol_manuale;
  });
  if (!Object.keys(correzioni).length) return prestazioni;
  return prestazioni.map((pr) => {
    const chiave = `${pr.partita_id}_${pr.giocatore_id}`;
    return chiave in correzioni ? { ...pr, gol: correzioni[chiave] } : pr;
  });
}

// sostituisce prestazioni.voto con un "voto arricchito" quando il capitano
// avversario ha votato quel giocatore e/o quando un capitano ha escluso
// un voto pigro di un proprio compagno (voti_ricevuti.anomalo): il voto
// Fubles resta il numero di base, sempre disponibile — questa funzione
// tocca solo le partite di una stagione con peso_voto_capitano impostato
// (mai obbligatorio) e solo quando esiste davvero un input nuovo, per
// non introdurre differenze di arrotondamento senza motivo visibile.
export function applicaVotoArricchito(prestazioni, votiRicevuti, votiCapitano, partite, stagioni) {
  const pesoByStagione = {};
  stagioni.forEach((s) => { if (s.peso_voto_capitano != null) pesoByStagione[s.id] = s.peso_voto_capitano; });
  const pesoByPartita = {};
  partite.forEach((p) => { if (p.stagione_id != null && pesoByStagione[p.stagione_id] != null) pesoByPartita[p.id] = pesoByStagione[p.stagione_id]; });
  if (!Object.keys(pesoByPartita).length) return prestazioni;

  const votiByChiave = {};
  votiRicevuti.forEach((v) => {
    const chiave = `${v.partita_id}_${v.valutato_id}`;
    const gruppo = (votiByChiave[chiave] = votiByChiave[chiave] || { tutti: 0, validi: [] });
    gruppo.tutti++;
    if (!v.anomalo) gruppo.validi.push(Number(v.voto));
  });

  const capitanoByChiave = {};
  votiCapitano.forEach((v) => { capitanoByChiave[`${v.partita_id}_${v.giocatore_id}`] = Number(v.voto); });

  return prestazioni.map((pr) => {
    const peso = pesoByPartita[pr.partita_id];
    if (peso == null) return pr;
    const chiave = `${pr.partita_id}_${pr.giocatore_id}`;
    const gruppo = votiByChiave[chiave];
    const votoCapitano = capitanoByChiave[chiave];
    const nEsclusi = gruppo ? gruppo.tutti - gruppo.validi.length : 0;
    if (!nEsclusi && votoCapitano == null) return pr; // niente di nuovo: resta il voto Fubles

    const mediaPulita = gruppo && gruppo.validi.length
      ? gruppo.validi.reduce((a, b) => a + b, 0) / gruppo.validi.length
      : (pr.voto == null ? null : Number(pr.voto));

    let votoArricchito;
    if (votoCapitano != null && mediaPulita != null) votoArricchito = (mediaPulita + peso * votoCapitano) / (1 + peso);
    else if (votoCapitano != null) votoArricchito = votoCapitano;
    else votoArricchito = mediaPulita;

    if (votoArricchito == null) return pr;
    return { ...pr, voto: votoArricchito, voto_fubles: pr.voto };
  });
}

// punteggio di una partita in diretta: somma i gol_manuale inseriti dal
// cronista per ciascuna squadra (un autogol conta per la squadra
// avversaria) — usato al posto di partite.gol_squadra_1/2, che per una
// partita "live" restano null finché qualcuno non imposta un risultato
// ufficiale a fine partita.
export function calcolaPunteggioLive(prestazioni, datiManuali) {
  const squadraByGiocatore = {};
  const squadre = [];
  prestazioni.forEach((p) => {
    squadraByGiocatore[p.giocatore_id] = p.squadra;
    if (!squadre.includes(p.squadra)) squadre.push(p.squadra);
  });
  const punteggio = {};
  squadre.forEach((s) => { punteggio[s] = 0; });
  const altraSquadra = (s) => squadre.find((x) => x !== s);

  datiManuali.forEach((d) => {
    const squadra = squadraByGiocatore[d.giocatore_id];
    if (!squadra) return;
    if (d.gol_manuale) punteggio[squadra] = (punteggio[squadra] || 0) + Number(d.gol_manuale);
    if (d.autogol) {
      const avversaria = altraSquadra(squadra);
      if (avversaria) punteggio[avversaria] = (punteggio[avversaria] || 0) + Number(d.autogol);
    }
  });
  return punteggio;
}

/* ---------- assemblaggio dati dal DB ---------- */
export function assemble(partite, giocatori, prestazioni, votiRaw, votiCapitano = []) {
  const P = {};
  giocatori.forEach((g) => { P[g.id] = { id: g.id, nome: g.nome, nick: g.nickname, foto: g.foto_url, numero: g.numero_maglia, ruolo: g.ruolo_prevalente || "CEN" }; });

  const prByMatch = {};
  prestazioni.forEach((pr) => {
    (prByMatch[pr.partita_id] = prByMatch[pr.partita_id] || []).push(pr);
  });

  const partiteConVotoCapitano = new Set(votiCapitano.map((v) => v.partita_id));

  const matches = [...partite]
    .sort((a, b) => (a.data < b.data ? -1 : 1))
    .map((m) => {
      const rows = prByMatch[m.id] || [];
      const teams = { [m.squadra_1]: [], [m.squadra_2]: [] };
      const stats = {};
      let mvp = 0;
      rows.forEach((pr) => {
        if (teams[pr.squadra]) teams[pr.squadra].push(pr.giocatore_id);
        stats[pr.giocatore_id] = [pr.voto == null ? null : Number(pr.voto), pr.gol || 0, pr.ruolo || null];
        if (pr.motm) mvp = pr.giocatore_id;
      });
      // se i capitani hanno votato questa partita, l'MVP segue il voto
      // (già arricchito) più alto invece del flag motm importato da Fubles
      if (partiteConVotoCapitano.has(m.id)) {
        let miglior = null, migliorVoto = -Infinity;
        rows.forEach((pr) => {
          const v = pr.voto == null ? null : Number(pr.voto);
          if (v != null && v > migliorVoto) { migliorVoto = v; miglior = pr.giocatore_id; }
        });
        if (miglior != null) mvp = miglior;
      }
      return {
        dbId: m.id, id: m.match_id, d: fmtData(m.data), data: m.data,
        f: [m.forza_squadra_1, m.forza_squadra_2],
        score: { [m.squadra_1]: m.gol_squadra_1, [m.squadra_2]: m.gol_squadra_2 },
        mvp, teams, stats,
      };
    });

  const idxByDb = {};
  matches.forEach((m, i) => { idxByDb[m.dbId] = i; });
  const votes = votiRaw
    .filter((v) => !v.anomalo)
    .map((v) => [idxByDb[v.partita_id], v.valutato_id, v.votante_id, Number(v.voto)]);

  return { P, matches, votes };
}

/* ---------- motore di calcolo ---------- */
export function buildStats(P, MATCHES) {
  const S = {};
  Object.values(P).forEach((p) => {
    S[p.id] = { ...p, presenze: 0, w: 0, d: 0, l: 0, gol: 0, voti: [], mvp: 0, storico: [], forma: [] };
  });
  MATCHES.forEach((m) => {
    const names = Object.keys(m.teams);
    names.forEach((team) => {
      const other = names.find((t) => t !== team);
      const gf = m.score[team], gs = m.score[other];
      const esito = gf > gs ? "W" : gf < gs ? "L" : "D";
      m.teams[team].forEach((pid) => {
        const s = S[pid];
        if (!s) return;
        const [voto, gol] = m.stats[pid] || [null, 0];
        s.presenze++; s.gol += gol;
        if (voto != null) s.voti.push(voto);
        if (esito === "W") s.w++; else if (esito === "L") s.l++; else s.d++;
        if (m.mvp === pid) s.mvp++;
        s.storico.push({ match: m, team, esito, voto, gol, score: `${gf}–${gs}` });
        s.forma.push(esito);
      });
    });
  });
  const all = Object.values(S).filter((s) => s.voti.length);
  all.forEach((s) => {
    s.mediaVoto = s.voti.reduce((a, b) => a + b, 0) / s.voti.length;
    s.winRate = s.presenze ? s.w / s.presenze : 0;
    s.golPerMatch = s.presenze ? s.gol / s.presenze : 0;
    s.punti = s.w * 3 + s.d;
  });
  const mvs = all.map((s) => s.mediaVoto);
  const mean = mvs.reduce((a, b) => a + b, 0) / (mvs.length || 1);
  const std = Math.sqrt(mvs.reduce((a, b) => a + (b - mean) ** 2, 0) / (mvs.length || 1)) || 1;
  all.forEach((s) => {
    const z = clamp((s.mediaVoto - mean) / std, -2.2, 2.2);
    s.overall = clamp(Math.round(72 + z * 9 + (s.winRate - 0.5) * 8 + Math.min(s.golPerMatch, 1.5) * 5), 55, 96);
  });
  return S;
}

export function pairAndNemesis(MATCHES) {
  const together = {}, against = {};
  MATCHES.forEach((m) => {
    const names = Object.keys(m.teams);
    names.forEach((team) => {
      const other = names.find((t) => t !== team);
      const r = m.score[team] > m.score[other] ? "W" : m.score[team] < m.score[other] ? "L" : "D";
      const mates = m.teams[team], opps = m.teams[other];
      mates.forEach((a) => {
        mates.forEach((b) => {
          if (a >= b) return;
          const k = `${a}-${b}`;
          together[k] = together[k] || { games: 0, w: 0 };
          together[k].games++; if (r === "W") together[k].w++;
        });
        opps.forEach((o) => {
          const k = `${a}>${o}`;
          against[k] = against[k] || { games: 0, w: 0 };
          against[k].games++; if (r === "W") against[k].w++;
        });
      });
    });
  });
  return { together, against };
}

export function bestPartner(pid, rel) {
  let best = null;
  Object.entries(rel.together).forEach(([k, v]) => {
    const [a, b] = k.split("-").map(Number);
    if ((a !== pid && b !== pid) || v.games < MIN_REL) return;
    const wr = v.w / v.games;
    if (!best || wr > best.wr || (wr === best.wr && v.games > best.games)) best = { mate: a === pid ? b : a, wr, ...v };
  });
  return best;
}
export function worstNemesis(pid, rel) {
  let worst = null;
  Object.entries(rel.against).forEach(([k, v]) => {
    const [a, o] = k.split(">").map(Number);
    if (a !== pid || v.games < MIN_REL) return;
    const wr = v.w / v.games;
    if (!worst || wr < worst.wr || (wr === worst.wr && v.games > worst.games)) worst = { opp: o, wr, ...v };
  });
  return worst;
}

export function fanCritic(pid, VOTES) {
  const by = {};
  VOTES.forEach(([, val, votante, voto]) => {
    if (val !== pid) return;
    by[votante] = by[votante] || { n: 0, tot: 0 };
    by[votante].n++; by[votante].tot += voto;
  });
  const list = Object.entries(by).map(([v, d]) => ({ votante: +v, n: d.n, avg: d.tot / d.n }));
  const eligible = list.filter((x) => x.n >= 2);
  const pool = eligible.length ? eligible : list;
  if (!pool.length) return { nVoti: 0 };
  const fan = [...pool].sort((a, b) => b.avg - a.avg || b.n - a.n)[0];
  const critic = [...pool].sort((a, b) => a.avg - b.avg || b.n - a.n)[0];
  return { nVoti: list.reduce((a, x) => a + x.n, 0), fan, critic };
}

// solo dati veri (nessun attributo stile FIFA inventato: velocità, tiro
// ecc. non li misuriamo, quindi non li mostriamo).
export function cardStats(s) {
  return [
    ["PRES", s.presenze],
    ["GOL", s.gol],
    ["VOTO", s.mediaVoto.toFixed(2)],
    ["MVP", s.mvp],
    ["WIN%", Math.round(s.winRate * 100)],
    ["PT", s.punti],
  ];
}

export const tier = (ov) => (ov >= 82 ? "gold" : ov >= 72 ? "silver" : "bronze");

/* ---------- Team of the Week ---------- */
const RUOLI_TOTW = ["POR", "DIF", "CEN", "ATT"];
const FORMAZIONE_1338 = { POR: 1, DIF: 3, CEN: 3, ATT: 1 };

export function buildTOTW(m, P) {
  const players = Object.values(m.teams).flat()
    .map((pid) => {
      const [voto, gol, ruoloPartita] = m.stats[pid] || [null, 0, null];
      const p = P[pid];
      if (!p || voto == null) return null;
      const ruolo = RUOLI_TOTW.includes(ruoloPartita) ? ruoloPartita : (RUOLI_TOTW.includes(p.ruolo) ? p.ruolo : "CEN");
      return { ...p, voto, gol, mvp: m.mvp === pid, ruolo };
    })
    .filter(Boolean);

  const byRole = {};
  RUOLI_TOTW.forEach((r) => { byRole[r] = players.filter((p) => p.ruolo === r).sort((a, b) => b.voto - a.voto); });

  const bande = { POR: [], DIF: [], CEN: [], ATT: [] };
  const usedIds = new Set();
  let adattata = false;

  RUOLI_TOTW.forEach((r) => {
    const n = FORMAZIONE_1338[r];
    const pick = byRole[r].filter((p) => !usedIds.has(p.id)).slice(0, n);
    pick.forEach((p) => { bande[r].push(p); usedIds.add(p.id); });
    const mancano = n - pick.length;
    if (mancano > 0) {
      adattata = true;
      const rimanenti = players.filter((p) => !usedIds.has(p.id)).sort((a, b) => b.voto - a.voto).slice(0, mancano);
      rimanenti.forEach((p) => { bande[r].push(p); usedIds.add(p.id); });
    }
  });

  return { bande, adattata, disponibili: players.length };
}

/* ---------- badge ---------- */
export function computeBadges(s, players) {
  const badges = [];
  const tierFor = (v, [b, si, g]) => (v >= g ? "gold" : v >= si ? "silver" : v >= b ? "bronze" : null);

  const presTier = tierFor(s.presenze, [5, 10, 25]);
  if (presTier) badges.push({ id: "presenze", icon: "🎽", nome: "Stacanovista", tier: presTier });

  const golTier = tierFor(s.gol, [5, 10, 25]);
  if (golTier) badges.push({ id: "gol", icon: "⚽", nome: "Goleador", tier: golTier });

  const mvpTier = tierFor(s.mvp, [1, 3, 5]);
  if (mvpTier) badges.push({ id: "mvp", icon: "⭐", nome: "Man of the Match", tier: mvpTier });

  let cur = 0, best = 0;
  s.forma.forEach((e) => { cur = e === "W" ? cur + 1 : 0; best = Math.max(best, cur); });
  const serieTier = best >= 5 ? "gold" : best >= 3 ? "bronze" : null;
  if (serieTier) badges.push({ id: "serie", icon: "🔥", nome: "On Fire", tier: serieTier });

  if (s.ruolo === "POR" && s.presenze >= 3) {
    badges.push({ id: "saracinesca", icon: "🧤", nome: "Saracinesca", tier: "bronze" });
  }

  const eligibili = players.filter((p) => p.presenze >= 3);
  if (eligibili.length) {
    const peggio = [...eligibili].sort((a, b) => a.mediaVoto - b.mediaVoto)[0];
    if (peggio.id === s.id) badges.push({ id: "scarso", icon: "🗑", nome: "Scarso Certificato", tier: "bronze" });
  }

  return badges;
}

/* ---------- Player of the Month ---------- */
// mese solare corrente, min. 2 presenze nel mese, punteggio = media voto
// del mese + bonus win rate + bonus MVP (pesi scelti per restare vicini
// alla scala 1-10 dei voti, senza stravolgerla).
export function computePlayerOfTheMonth(MATCHES, oraIso = new Date().toISOString().slice(0, 10)) {
  const meseCorrente = oraIso.slice(0, 7); // "YYYY-MM"
  const inMese = MATCHES.filter((m) => m.data && m.data.slice(0, 7) === meseCorrente);
  if (!inMese.length) return null;

  const agg = {};
  inMese.forEach((m) => {
    const names = Object.keys(m.teams);
    names.forEach((team) => {
      const other = names.find((t) => t !== team);
      const esito = m.score[team] > m.score[other] ? "W" : m.score[team] < m.score[other] ? "L" : "D";
      m.teams[team].forEach((pid) => {
        const [voto] = m.stats[pid] || [null, 0];
        const s = (agg[pid] = agg[pid] || { presenze: 0, voti: [], w: 0, mvp: 0 });
        s.presenze++;
        if (voto != null) s.voti.push(voto);
        if (esito === "W") s.w++;
        if (m.mvp === pid) s.mvp++;
      });
    });
  });

  const candidati = Object.entries(agg)
    .map(([pid, s]) => ({
      id: Number(pid),
      presenze: s.presenze,
      mediaVoto: s.voti.length ? s.voti.reduce((a, b) => a + b, 0) / s.voti.length : null,
      winRate: s.presenze ? s.w / s.presenze : 0,
      mvp: s.mvp,
    }))
    .filter((c) => c.presenze >= 2 && c.mediaVoto != null);

  if (!candidati.length) return null;

  candidati.forEach((c) => { c.punteggio = c.mediaVoto + c.winRate * 1.2 + c.mvp * 0.3; });
  candidati.sort((a, b) => b.punteggio - a.punteggio);
  return candidati[0];
}

/* ---------- grafici andamento profilo ---------- */
export function distribuzioneVoti(players) {
  const mvs = players.map((p) => p.mediaVoto).filter((v) => v != null);
  const mean = mvs.length ? mvs.reduce((a, b) => a + b, 0) / mvs.length : 0;
  const std = (mvs.length ? Math.sqrt(mvs.reduce((a, b) => a + (b - mean) ** 2, 0) / mvs.length) : 0) || 1;
  return { mean, std };
}

// overall "storico": stesso identico calcolo di buildStats, ma applicato
// via via ai dati cumulati del giocatore fino a quella partita (mean/std
// della lega presi come fissi: approssimazione ragionevole su una stagione).
export function computeAndamento(storico, mean, std) {
  let gol = 0, w = 0, n = 0;
  const voti = [];
  return storico.map((r) => {
    n++;
    if (r.esito === "W") w++;
    gol += r.gol || 0;
    if (r.voto != null) voti.push(r.voto);
    const mediaVoto = voti.length ? voti.reduce((a, b) => a + b, 0) / voti.length : null;
    let overall = null;
    if (mediaVoto != null) {
      const z = clamp((mediaVoto - mean) / std, -2.2, 2.2);
      const winRate = n ? w / n : 0;
      const golPerMatch = n ? gol / n : 0;
      overall = clamp(Math.round(72 + z * 9 + (winRate - 0.5) * 8 + Math.min(golPerMatch, 1.5) * 5), 55, 96);
    }
    return { voto: r.voto, overall, data: r.match?.d };
  });
}

/* ---------- XP e livelli ---------- */
// XP cumulativo all-time (mai filtrato per stagione): è la progressione del
// giocatore, non una classifica stagionale. Nessuna penalità, solo bonus.
export const PUNTI_XP = {
  presenza: 10, vittoria: 15, pareggio: 8, gol: 12, assist: 8, mvp: 25,
  votoAlto: 10, votoOttimo: 20, cleanSheet: 15,
};

// s: oggetto stats giocatore (con .id e .storico cronologico) da buildStats,
// costruito su TUTTE le partite della lega (non filtrate per stagione).
// datiManualiByChiave: mappa "partitaDbId_giocatoreId" -> riga dati_manuali.
export function computeXP(s, datiManualiByChiave) {
  const rip = { presenze: 0, vittorie: 0, gol: 0, assist: 0, mvp: 0, voto: 0, cleanSheet: 0 };
  s.storico.forEach((r) => {
    rip.presenze += PUNTI_XP.presenza;
    if (r.esito === "W") rip.vittorie += PUNTI_XP.vittoria;
    else if (r.esito === "D") rip.vittorie += PUNTI_XP.pareggio;
    if (r.gol > 0) rip.gol += r.gol * PUNTI_XP.gol;
    if (r.match?.mvp === s.id) rip.mvp += PUNTI_XP.mvp;
    if (r.voto != null) {
      rip.voto += r.voto >= 8 ? PUNTI_XP.votoOttimo : r.voto >= 7.5 ? PUNTI_XP.votoAlto : 0;
    }
    const dm = datiManualiByChiave[`${r.match?.dbId}_${s.id}`];
    if (dm) {
      if (dm.assist) rip.assist += dm.assist * PUNTI_XP.assist;
      if (dm.clean_sheet) rip.cleanSheet += PUNTI_XP.cleanSheet;
    }
  });
  const totale = Object.values(rip).reduce((a, b) => a + b, 0);
  return { totale, ripartizione: rip };
}

// soglie iniziali stimate su una stagione di calcetto settimanale
// (~30-40 partite/anno): da ritarare quando si vedono gli XP reali.
export const LIVELLI = [
  { nome: "Esordiente", soglia: 0 },
  { nome: "Amatore", soglia: 150 },
  { nome: "Titolare", soglia: 400 },
  { nome: "Pro", soglia: 800 },
  { nome: "Veterano", soglia: 1500 },
  { nome: "Campione", soglia: 2500 },
  { nome: "Leggenda", soglia: 4000 },
];

export function computeLivello(xpTotale) {
  let corrente = LIVELLI[0], prossimo = LIVELLI[1] || null;
  for (let i = 0; i < LIVELLI.length; i++) {
    if (xpTotale >= LIVELLI[i].soglia) { corrente = LIVELLI[i]; prossimo = LIVELLI[i + 1] || null; }
  }
  const progresso = prossimo ? clamp((xpTotale - corrente.soglia) / (prossimo.soglia - corrente.soglia), 0, 1) : 1;
  return { nome: corrente.nome, prossimoNome: prossimo?.nome ?? null, sogliaProssimo: prossimo?.soglia ?? null, progresso };
}

/* ---------- traduzione errori Supabase/Postgres ---------- */
// non nasconde tutto (l'admin a volte deve capire cosa è successo davvero),
// ma copre i casi più comuni con un messaggio comprensibile in italiano.
export function tradErroreDb(msg) {
  if (!msg) return "Si è verificato un errore imprevisto.";
  const m = msg.toLowerCase();
  if (m.includes("duplicate key") || m.includes("already exists")) return "Questo elemento esiste già.";
  if (m.includes("violates foreign key constraint")) return "Operazione non permessa: ci sono dati collegati da rimuovere prima.";
  if (m.includes("permission denied") || m.includes("row-level security")) return "Non hai i permessi per questa operazione.";
  if (m.includes("failed to fetch") || m.includes("networkerror") || m.includes("network request failed")) return "Problema di connessione: controlla la rete e riprova.";
  if (m.includes("value too long")) return "Testo troppo lungo per questo campo.";
  if (m.includes("invalid input syntax")) return "Formato non valido per questo campo.";
  if (m.includes("null value in column") && m.includes("not-null constraint")) return "Manca un campo obbligatorio.";
  return msg;
}
