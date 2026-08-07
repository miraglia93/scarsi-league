"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";

/* ============================================================
   SCARSI LEAGUE — Next.js + Supabase (dati live)
   ============================================================ */

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const MIN_REL = 2;
const MESI = ["Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago", "Set", "Ott", "Nov", "Dic"];
const fmtData = (iso) => {
  const d = new Date(iso + "T00:00:00");
  return `${d.getDate()} ${MESI[d.getMonth()]}`;
};

/* ---------- assemblaggio dati dal DB ---------- */
function assemble(partite, giocatori, prestazioni, votiRaw) {
  const P = {};
  giocatori.forEach((g) => { P[g.id] = { id: g.id, nome: g.nome, nick: g.nickname, foto: g.foto_url, numero: g.numero_maglia, ruolo: g.ruolo_prevalente || "CEN" }; });

  const prByMatch = {};
  prestazioni.forEach((pr) => {
    (prByMatch[pr.partita_id] = prByMatch[pr.partita_id] || []).push(pr);
  });

  const matches = [...partite]
    .sort((a, b) => (a.data < b.data ? -1 : 1))
    .map((m) => {
      const rows = prByMatch[m.id] || [];
      const teams = { [m.squadra_1]: [], [m.squadra_2]: [] };
      const stats = {};
      let mvp = 0;
      rows.forEach((pr) => {
        if (teams[pr.squadra]) teams[pr.squadra].push(pr.giocatore_id);
        stats[pr.giocatore_id] = [pr.voto == null ? null : Number(pr.voto), pr.gol || 0];
        if (pr.motm) mvp = pr.giocatore_id;
      });
      return {
        dbId: m.id, id: m.match_id, d: fmtData(m.data),
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
function buildStats(P, MATCHES) {
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

function pairAndNemesis(MATCHES) {
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

function bestPartner(pid, rel) {
  let best = null;
  Object.entries(rel.together).forEach(([k, v]) => {
    const [a, b] = k.split("-").map(Number);
    if ((a !== pid && b !== pid) || v.games < MIN_REL) return;
    const wr = v.w / v.games;
    if (!best || wr > best.wr || (wr === best.wr && v.games > best.games)) best = { mate: a === pid ? b : a, wr, ...v };
  });
  return best;
}
function worstNemesis(pid, rel) {
  let worst = null;
  Object.entries(rel.against).forEach(([k, v]) => {
    const [a, o] = k.split(">").map(Number);
    if (a !== pid || v.games < MIN_REL) return;
    const wr = v.w / v.games;
    if (!worst || wr < worst.wr || (wr === worst.wr && v.games > worst.games)) worst = { opp: o, wr, ...v };
  });
  return worst;
}

function fanCritic(pid, VOTES) {
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

function cardStats(s) {
  const j = (n) => ((s.id * 7 + n * 13) % 9) - 4;
  const base = clamp(Math.round(s.overall - 8), 45, 92);
  return [
    ["VEL", clamp(base + j(1) + (s.ruolo === "ATT" ? 6 : 0), 40, 96)],
    ["TIR", clamp(Math.round(46 + s.golPerMatch * 22) + j(2), 40, 96)],
    ["PAS", clamp(base + j(3) + (s.ruolo === "CEN" ? 7 : 0), 40, 96)],
    ["DRI", clamp(base + j(4) + (s.ruolo === "ATT" ? 4 : 0), 40, 96)],
    ["DIF", clamp(base + j(5) + (s.ruolo === "DIF" ? 10 : s.ruolo === "POR" ? 8 : -8), 40, 96)],
    ["FIS", clamp(Math.round(50 + s.winRate * 30) + j(6), 40, 96)],
  ];
}

/* ---------- componenti UI ---------- */
const tier = (ov) => (ov >= 82 ? "gold" : ov >= 72 ? "silver" : "bronze");

function FormaDots({ forma, n = 5 }) {
  return (
    <span className="forma">
      {forma.slice(-n).map((e, i) => <i key={i} className={`dot ${e}`} title={e} />)}
    </span>
  );
}

function PlayerCard({ s, size = "lg", onClick }) {
  const t = tier(s.overall);
  return (
    <div className={`fut ${t} ${size}`} onClick={onClick} role={onClick ? "button" : undefined} tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => e.key === "Enter" && onClick() : undefined}>
      <div className="fut-top">
        <div className="fut-ov">{s.overall}</div>
        <div className="fut-pos">{s.ruolo}</div>
        <div className="fut-num">{s.numero ? `#${s.numero}` : `${s.presenze} pres.`}</div>
      </div>
      {s.foto
        ? <img className="fut-foto" src={s.foto} alt={s.nome} />
        : <div className="fut-avatar">{s.nome.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()}</div>}
      <div className="fut-name" title={s.nome}>{s.nick || s.nome}</div>
      {size === "lg" && (
        <div className="fut-stats">
          {cardStats(s).map(([k, v]) => <div key={k}><b>{v}</b><span>{k}</span></div>)}
        </div>
      )}
    </div>
  );
}

function MiniTable({ title, rows, cols, note }) {
  return (
    <div>
      <h3>{title}</h3>
      {note && <div className="note">{note}</div>}
      <table>
        <thead><tr><th className="rank">#</th>{cols.map((c) => <th key={c} className={c === "Giocatore" ? "" : "num"}>{c}</th>)}</tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              <td className="rank">{i + 1}</td>
              {r.map((c, j) => <td key={j} className={j === 0 ? "pname" : "num"}>{c}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Login() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const send = async () => {
    setBusy(true); setErr("");
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: typeof window !== "undefined" ? window.location.origin : undefined },
    });
    setBusy(false);
    if (error) setErr(error.message); else setSent(true);
  };

  const google = async () => {
    setErr("");
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: typeof window !== "undefined" ? window.location.origin : undefined },
    });
    if (error) setErr("Accesso Google non disponibile: " + error.message);
  };

  return (
    <div className="login">
      <h1>Scarsi <em>League</em></h1>
      <p className="season">Accesso riservato ai membri della lega</p>
      {sent ? (
        <p className="msg">✉️ Fatto! Controlla la tua email e clicca il link di accesso.</p>
      ) : (
        <>
          <button className="gbtn" onClick={google}>Continua con Google</button>
          <div className="divider"><span>oppure</span></div>
          <input type="email" placeholder="la-tua-email@esempio.it" value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && email && send()} />
          <button onClick={send} disabled={busy || !email}>{busy ? "Invio…" : "Inviami il link di accesso"}</button>
          {err && <p className="msg">⚠ {err}</p>}
          <p className="msg">Continuando accetti la <a className="plink" href="/privacy">Privacy Policy</a> della lega.</p>
        </>
      )}
    </div>
  );
}

function RichiediAccesso({ email }) {
  const [nome, setNome] = useState("");
  const [messaggio, setMessaggio] = useState("");
  const [stato, setStato] = useState(null); // null=verifica, 'nuova', 'inviata', 'errore'
  const [err, setErr] = useState("");

  useEffect(() => {
    supabase.from("richieste_accesso").select("stato")
      .eq("email", (email || "").toLowerCase()).maybeSingle()
      .then(({ data }) => setStato(data ? "inviata" : "nuova"));
  }, []);

  const invia = async () => {
    const { error } = await supabase.from("richieste_accesso").insert({
      email: (email || "").toLowerCase(), nome, messaggio,
    });
    if (error) { setErr(error.message); setStato("errore"); }
    else setStato("inviata");
  };

  return (
    <div className="login">
      <h1>Scarsi <em>League</em></h1>
      {stato === "inviata" ? (
        <>
          <p className="season">Richiesta inviata ✅</p>
          <p className="msg">
            Alessandro deve approvarti — di solito lo fa prima del fischio d&apos;inizio.
            Riapri il sito dopo l&apos;ok e sei dentro.
          </p>
          <button onClick={() => supabase.auth.signOut()}>Esci</button>
        </>
      ) : stato === "nuova" || stato === "errore" ? (
        <>
          <p className="season">Un ultimo passo</p>
          <p className="msg">
            L&apos;email <b>{email}</b> non è ancora tra i membri.
            Se giochi con noi, richiedi l&apos;accesso:
          </p>
          <input placeholder="Il tuo nome (come su Fubles)" value={nome}
            onChange={(e) => setNome(e.target.value)} />
          <input placeholder="Messaggio (opzionale) — es. gioco in porta" value={messaggio}
            onChange={(e) => setMessaggio(e.target.value)} />
          <button onClick={invia} disabled={!nome}>Richiedi accesso</button>
          {err && <p className="msg">⚠ {err}</p>}
        </>
      ) : (
        <p className="msg">Verifica in corso…</p>
      )}
    </div>
  );
}

const VERSIONE_PRIVACY = "2026-08";

function Consenso({ email, onAccettato }) {
  const [ok, setOk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const accetta = async () => {
    setBusy(true); setErr("");
    const { error } = await supabase.from("consensi").insert({
      email: (email || "").toLowerCase(),
      versione: VERSIONE_PRIVACY,
    });
    setBusy(false);
    if (error) setErr(error.message); else onAccettato();
  };

  return (
    <div className="login">
      <h1>Scarsi <em>League</em></h1>
      <p className="season">Prima di entrare</p>
      <p className="msg">
        Scarsi League raccoglie statistiche della lega (nomi, risultati, voti delle
        pagelle) importate da Fubles, visibili solo ai membri approvati.
        I dettagli su cosa raccogliamo, perché, e come chiedere la rimozione
        sono nella <a className="plink" href="/privacy" target="_blank" rel="noreferrer">Privacy Policy</a>.
      </p>
      <label className="check">
        <input type="checkbox" checked={ok} onChange={(e) => setOk(e.target.checked)} />
        <span>Ho letto e accetto la Privacy Policy (v. {VERSIONE_PRIVACY})</span>
      </label>
      <button onClick={accetta} disabled={!ok || busy}>{busy ? "Un attimo…" : "Accetto ed entro"}</button>
      {err && <p className="msg">⚠ {err}</p>}
      <p className="msg"><a className="plink" href="#" onClick={(e) => { e.preventDefault(); supabase.auth.signOut(); }}>Non accetto, esci</a></p>
    </div>
  );
}

/* ---------- pagina principale ---------- */
export default function Home() {
  const [session, setSession] = useState(undefined); // undefined = loading
  const [consenso, setConsenso] = useState(null); // null = verifica, false = da accettare
  const [autorizzato, setAutorizzato] = useState(null); // null = verifica in corso
  const [ruoloUtente, setRuoloUtente] = useState("membro");
  const [leghe, setLeghe] = useState([]);
  const [legaId, setLegaId] = useState(null);
  const [raw, setRaw] = useState(null);
  const [errore, setErrore] = useState("");
  const [view, setView] = useState("home");
  const [sel, setSel] = useState(null);
  const [soloRegulars, setSoloRegulars] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) return;
    (async () => {
      // 1) consenso privacy registrato?
      const mailC = (session.user?.email || "").toLowerCase();
      const { data: c } = await supabase.from("consensi").select("email").eq("email", mailC).maybeSingle();
      if (!c) { setConsenso(false); return; }
      setConsenso(true);
      // 2) verifica whitelist: la RLS mostra solo la propria riga
      const mail = (session.user?.email || "").toLowerCase();
      const { data: me } = await supabase
        .from("membri_autorizzati")
        .select("email, ruolo")
        .eq("email", mail)
        .maybeSingle();
      if (!me) { setAutorizzato(false); return; }
      setAutorizzato(true);
      setRuoloUtente(me.ruolo || "membro");
      const [pa, gi, pr, vo, le] = await Promise.all([
        supabase.from("partite").select("*"),
        supabase.from("giocatori").select("*"),
        supabase.from("prestazioni").select("*"),
        supabase.from("voti_ricevuti").select("*"),
        supabase.from("leghe").select("*").order("id"),
      ]);
      const err = pa.error || gi.error || pr.error || vo.error;
      if (err) { setErrore(err.message); return; }
      setLeghe(le.data || []);
      setLegaId((le.data || [])[0]?.id ?? null);
      setRaw({ pa: pa.data, gi: gi.data, pr: pr.data, vo: vo.data });
    })();
  }, [session]);

  const data = useMemo(() => {
    if (!raw || legaId == null) return null;
    const gi = raw.gi.filter((g) => g.lega_id === legaId);
    const ids = new Set(gi.map((g) => g.id));
    const pa = raw.pa.filter((p) => p.lega_id === legaId);
    const paIds = new Set(pa.map((p) => p.id));
    const pr = raw.pr.filter((p) => paIds.has(p.partita_id));
    const vo = raw.vo.filter((v) => paIds.has(v.partita_id));
    if (!pa.length) return { P: {}, matches: [], votes: [], vuota: true };
    return assemble(pa, gi, pr, vo);
  }, [raw, legaId]);
  const S = useMemo(() => (data && !data.vuota ? buildStats(data.P, data.matches) : null), [data]);
  const rel = useMemo(() => (data ? pairAndNemesis(data.matches) : null), [data]);

  if (session === undefined) return <div className="centered">Caricamento…</div>;
  if (!session) return <Login />;
  if (consenso === false) {
    return <Consenso email={session.user?.email} onAccettato={() => { setConsenso(true); window.location.reload(); }} />;
  }
  if (autorizzato === false) {
    return <RichiediAccesso email={session.user?.email} />;
  }
  if (errore) return <div className="centered">Errore dati: {errore}</div>;
  if (data?.vuota) return (
    <div className="wrap">
      <div className="brand"><h1>Scarsi <em>League</em></h1></div>
      <nav>
        {leghe.length > 1 && (
          <select className="legasel" value={legaId ?? ""} onChange={(e) => setLegaId(Number(e.target.value))}>
            {leghe.map((l) => <option key={l.id} value={l.id}>{l.nome}</option>)}
          </select>
        )}
        <a className="navlink" href="/profilo">Profilo</a>
        {ruoloUtente === "admin" && <a className="navlink" href="/admin">Admin</a>}
      </nav>
      <p className="centered">Questa lega non ha ancora partite importate ⚽</p>
    </div>
  );
  if (!data || !S) return <div className="centered">Carico le partite…</div>;

  const { matches: MATCHES, votes: VOTES } = data;
  const players = Object.values(S).filter((p) => p.presenze > 0);
  const shown = soloRegulars ? players.filter((p) => p.presenze >= 2) : players;
  const classifica = [...shown].sort((a, b) => b.punti - a.punti || b.mediaVoto - a.mediaVoto);
  const last = MATCHES[MATCHES.length - 1];
  const lastTeams = Object.keys(last.teams);
  const totGol = MATCHES.reduce((a, m) => a + Object.values(m.score).reduce((x, y) => x + y, 0), 0);
  const golAttribuiti = players.reduce((a, p) => a + p.gol, 0);
  const capocannoniere = [...players].sort((a, b) => b.gol - a.gol)[0];
  const topVoto = [...players].filter((p) => p.presenze >= 2).sort((a, b) => b.mediaVoto - a.mediaVoto)[0];
  const topMvp = [...players].sort((a, b) => b.mvp - a.mvp || b.mediaVoto - a.mediaVoto)[0];

  let maxGolPartita = { v: 0 };
  MATCHES.forEach((m) => Object.entries(m.stats).forEach(([pid, [, g]]) => {
    if (g > maxGolPartita.v) maxGolPartita = { v: g, p: S[pid], m };
  }));
  let bestStreak = { v: 0 };
  players.forEach((p) => {
    let cur = 0, best = 0;
    p.forma.forEach((e) => { cur = e === "W" ? cur + 1 : 0; best = Math.max(best, cur); });
    if (best > bestStreak.v) bestStreak = { v: best, p };
  });
  let maxScarto = { v: -1 };
  MATCHES.forEach((m) => {
    const [a, b] = Object.values(m.score);
    if (Math.abs(a - b) > maxScarto.v) maxScarto = { v: Math.abs(a - b), m };
  });
  let topPartita = { v: 0 };
  MATCHES.forEach((m) => {
    const t = Object.values(m.score).reduce((x, y) => x + y, 0);
    if (t > topPartita.v) topPartita = { v: t, m };
  });

  const selS = sel != null ? S[sel] : null;
  const selPartner = selS ? bestPartner(selS.id, rel) : null;
  const selNemesis = selS ? worstNemesis(selS.id, rel) : null;
  const selFC = selS ? fanCritic(selS.id, VOTES) : null;

  return (
    <div className="wrap">
      <header>
        <div className="brand">
          <h1>Scarsi <em>League</em></h1>
          <span className="season">Calci8Lunedì · Bettinelli · Stagione 2026</span>
        </div>
        <span className="livebadge">● DATI LIVE DA SUPABASE</span>
      </header>

      <nav>
        {[["home", "Home"], ["classifiche", "Classifiche"], ["giocatori", "Giocatori"], ["record", "Record"]].map(([k, l]) => (
          <button key={k} className={view === k && sel == null ? "on" : ""} onClick={() => { setView(k); setSel(null); }}>{l}</button>
        ))}
        {leghe.length > 1 && (
          <select className="legasel" value={legaId ?? ""} onChange={(e) => setLegaId(Number(e.target.value))}>
            {leghe.map((l) => <option key={l.id} value={l.id}>{l.nome}</option>)}
          </select>
        )}
        <a className="navlink" href="/profilo">Profilo</a>
        {ruoloUtente === "admin" && <a className="navlink" href="/admin">Admin</a>}
        <button className="logout" onClick={() => supabase.auth.signOut()}>Esci</button>
      </nav>

      {sel == null && view === "home" && (
        <>
          <a className="hero" href={`/partita/${last.dbId}`}>
            <span className="lbl">Ultima partita · {last.d}</span>
            <div className="team"><b>{lastTeams[0]}</b><span>forza {last.f[0]}</span></div>
            <div className="score">{last.score[lastTeams[0]]}<span>–</span>{last.score[lastTeams[1]]}</div>
            <div className="team"><b>{lastTeams[1]}</b><span>forza {last.f[1]}</span></div>
            {last.mvp > 0 && S[last.mvp] && (
              <div className="mvpline">⭐ MVP <b>{S[last.mvp].nome}</b> · voto {last.stats[last.mvp][0]}</div>
            )}
          </a>

          <div className="strip">
            <div className="stat"><b>{MATCHES.length}</b><span>Partite</span></div>
            <div className="stat"><b>{players.length}</b><span>Giocatori</span></div>
            <div className="stat"><b>{totGol}</b><span>Gol totali</span></div>
            <div className="stat"><b>{(totGol / MATCHES.length).toFixed(1)}</b><span>Gol / partita</span></div>
            <div className="stat"><b>{VOTES.length}</b><span>Voti espressi</span></div>
          </div>
          <div className="note">⚠ Marcatori attribuiti su Fubles: {golAttribuiti} gol su {totGol} totali — classifiche marcatori parziali.</div>

          <h2>Classifica
            <span className="toggle">
              <button className={soloRegulars ? "on" : ""} onClick={() => setSoloRegulars(true)}>Regulars ≥2</button>
              <button className={!soloRegulars ? "on" : ""} onClick={() => setSoloRegulars(false)}>Tutti ({players.length})</button>
            </span>
          </h2>
          <table>
            <thead><tr>
              <th className="rank">#</th><th>Giocatore</th><th className="num">Pt</th><th className="num">P</th>
              <th className="num">V</th><th className="num">N</th><th className="num">S</th><th className="num">Gol</th>
              <th className="num">Media</th><th className="num">MVP</th><th>Forma</th>
            </tr></thead>
            <tbody>
              {classifica.map((p, i) => (
                <tr key={p.id} className="click" onClick={() => setSel(p.id)}>
                  <td className="rank">{i + 1}</td>
                  <td className="pname">{p.nome}</td>
                  <td className="num"><b>{p.punti}</b></td>
                  <td className="num">{p.presenze}</td>
                  <td className="num">{p.w}</td>
                  <td className="num">{p.d}</td>
                  <td className="num">{p.l}</td>
                  <td className="num">{p.gol}</td>
                  <td className="num">{p.mediaVoto.toFixed(2)}</td>
                  <td className="num">{p.mvp}</td>
                  <td><FormaDots forma={p.forma} /></td>
                </tr>
              ))}
            </tbody>
          </table>

          <h2>AI Insight della settimana</h2>
          <div className="insight">
            <b>{topVoto.nome}</b> ha la miglior media voto tra i regulars ({topVoto.mediaVoto.toFixed(2)} in {topVoto.presenze} partite).
            {" "}<b>{capocannoniere.nome}</b> guida i marcatori con {capocannoniere.gol} gol attribuiti.
            {" "}<b>{topMvp.nome}</b> è il giocatore col maggior numero di premi MVP ({topMvp.mvp}).
          </div>
        </>
      )}

      {sel == null && view === "classifiche" && (
        <>
          <h2>Classifiche di specialità</h2>
          <div className="grid2">
            <MiniTable title="⚽ Capocannonieri" note="⚠ Gol parzialmente attribuiti su Fubles"
              cols={["Giocatore", "Gol", "Pres."]}
              rows={[...players].filter((p) => p.gol > 0).sort((a, b) => b.gol - a.gol).slice(0, 8)
                .map((p) => [p.nome, p.gol, p.presenze])} />
            <MiniTable title="📈 Media voto (min. 2 presenze)"
              cols={["Giocatore", "Media", "Pres."]}
              rows={[...players].filter((p) => p.presenze >= 2).sort((a, b) => b.mediaVoto - a.mediaVoto).slice(0, 8)
                .map((p) => [p.nome, p.mediaVoto.toFixed(2), p.presenze])} />
            <MiniTable title="⭐ MVP"
              cols={["Giocatore", "MVP", "Pres."]}
              rows={[...players].filter((p) => p.mvp > 0).sort((a, b) => b.mvp - a.mvp).slice(0, 8)
                .map((p) => [p.nome, p.mvp, p.presenze])} />
            <MiniTable title="🎽 Presenze"
              cols={["Giocatore", "Pres.", "V-N-S"]}
              rows={[...players].sort((a, b) => b.presenze - a.presenze || b.mediaVoto - a.mediaVoto).slice(0, 8)
                .map((p) => [p.nome, p.presenze, `${p.w}-${p.d}-${p.l}`])} />
          </div>
        </>
      )}

      {sel == null && view === "giocatori" && (
        <>
          <h2>Rose e carte
            <span className="toggle">
              <button className={soloRegulars ? "on" : ""} onClick={() => setSoloRegulars(true)}>Regulars ≥2</button>
              <button className={!soloRegulars ? "on" : ""} onClick={() => setSoloRegulars(false)}>Tutti ({players.length})</button>
            </span>
          </h2>
          <div className="grid">
            {[...shown].sort((a, b) => b.overall - a.overall).map((p) => (
              <PlayerCard key={p.id} s={p} onClick={() => setSel(p.id)} />
            ))}
          </div>
        </>
      )}

      {sel == null && view === "record" && (
        <>
          <h2>Record</h2>
          <div className="rec">
            <div className="stat">
              <span>Più gol in una partita (attribuiti)</span>
              <b>{maxGolPartita.v} gol</b>
              <div className="who">{maxGolPartita.p?.nome} · {maxGolPartita.m?.d}</div>
            </div>
            <div className="stat">
              <span>Miglior serie di vittorie</span>
              <b>{bestStreak.v} di fila</b>
              <div className="who">{bestStreak.p?.nome}</div>
            </div>
            <div className="stat">
              <span>Vittoria con maggior scarto</span>
              <b>+{maxScarto.v}</b>
              <div className="who">{Object.entries(maxScarto.m.score).map(([t, g]) => `${t} ${g}`).join(" – ")} · {maxScarto.m.d}</div>
            </div>
            <div className="stat">
              <span>Partita con più gol</span>
              <b>{topPartita.v} gol</b>
              <div className="who">{Object.entries(topPartita.m.score).map(([t, g]) => `${t} ${g}`).join(" – ")} · {topPartita.m.d}</div>
            </div>
            <div className="stat">
              <span>Capocannoniere</span>
              <b>{capocannoniere.gol} gol</b>
              <div className="who">{capocannoniere.nome}</div>
            </div>
            <div className="stat">
              <span>Miglior media voto</span>
              <b>{topVoto.mediaVoto.toFixed(2)}</b>
              <div className="who">{topVoto.nome}</div>
            </div>
          </div>
        </>
      )}

      {selS && (
        <>
          <button className="back" onClick={() => setSel(null)}>← Indietro</button>
          <div className="detail">
            <PlayerCard s={selS} />
            <div>
              <div className="kv">
                <div className="stat"><b>{selS.presenze}</b><span>Presenze</span></div>
                <div className="stat"><b>{selS.w}-{selS.d}-{selS.l}</b><span>V-N-P</span></div>
                <div className="stat"><b>{selS.gol}</b><span>Gol attribuiti</span></div>
                <div className="stat"><b>{selS.mediaVoto.toFixed(2)}</b><span>Media voto</span></div>
                <div className="stat"><b>{selS.mvp}</b><span>MVP</span></div>
                <div className="stat"><b>{Math.round(selS.winRate * 100)}%</b><span>Win rate</span></div>
              </div>

              {selFC && selFC.nVoti > 0 && selFC.fan && selFC.critic && selFC.fan.votante !== selFC.critic.votante && S[selFC.fan.votante] && S[selFC.critic.votante] && (
                <div className="insight">
                  🗳️ <b>{selFC.nVoti} voti ricevuti.</b> Miglior fan: <b>{S[selFC.fan.votante].nome}</b> (media {selFC.fan.avg.toFixed(2)} in {selFC.fan.n} voti).
                  {" "}Critico più severo: <b>{S[selFC.critic.votante].nome}</b> (media {selFC.critic.avg.toFixed(2)} in {selFC.critic.n} voti).
                </div>
              )}
              {selPartner && S[selPartner.mate] && (
                <div className="insight">
                  👥 <b>Miglior coppia</b> — con <b>{S[selPartner.mate].nome}</b>: {selPartner.w} vittorie su {selPartner.games} partite insieme ({Math.round(selPartner.wr * 100)}%).
                </div>
              )}
              {selNemesis && S[selNemesis.opp] && (
                <div className="insight">
                  😈 <b>Nemesi</b> — contro <b>{S[selNemesis.opp].nome}</b> vince il {Math.round(selNemesis.wr * 100)}% delle volte ({selNemesis.w} su {selNemesis.games}).
                </div>
              )}

              <h2>Storico partite</h2>
              <table className="storico">
                <thead><tr>
                  <th>Data</th><th>Squadra</th><th>Risultato</th><th className="num">Voto</th><th className="num">Gol</th><th>Esito</th>
                </tr></thead>
                <tbody>
                  {[...selS.storico].reverse().map((r, i) => (
                    <tr key={i} className="click" onClick={() => { window.location.href = `/partita/${r.match.dbId}`; }}>
                      <td>{r.match.d}</td>
                      <td>{r.team}</td>
                      <td>{r.team} {r.score}</td>
                      <td className="num">{r.voto ?? "—"}</td>
                      <td className="num">{r.gol}</td>
                      <td><span className={`dot ${r.esito}`} style={{ display: "inline-block", width: 10, height: 10, borderRadius: "50%" }} /> {r.esito === "W" ? "Vittoria" : r.esito === "L" ? "Sconfitta" : "Pareggio"}{r.match.mvp === selS.id ? " · ⭐ MVP" : ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
