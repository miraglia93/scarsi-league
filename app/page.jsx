"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { assemble, buildStats, pairAndNemesis, bestPartner, worstNemesis, fanCritic, buildTOTW, computeBadges, computePlayerOfTheMonth, distribuzioneVoti, computeAndamento, computeXP, computeLivello, tradErroreDb } from "../lib/engine";
import PlayerCard from "../components/PlayerCard";
import FormaDots from "../components/FormaDots";
import MiniTable from "../components/MiniTable";
import AppNav from "../components/AppNav";
import SubTabs from "../components/SubTabs";
import ContextBar from "../components/ContextBar";
import { IconEdit, IconLock, IconLogout, IconMedal, IconShield } from "../components/icons";
import CopyButton from "../components/CopyButton";

/* ============================================================
   SCARSI LEAGUE — Next.js + Supabase (dati live)
   ============================================================ */

const MESI_LUNGHI = ["Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno", "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"];
const SEZIONI_VALIDE = ["lega", "partite", "classifiche", "giocatori", "tu"];

function TotwCard({ p }) {
  return (
    <div className="totwcard" title={p.nome}>
      {p.foto
        ? <img className="tc-foto" src={p.foto} alt={p.nome} />
        : <div className="tc-avatar">{(p.nick || p.nome).split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()}</div>}
      <span className="tc-name">{p.nick || p.nome}</span>
      <span className="tc-meta">
        {p.mvp && <i className="tc-mvp">⭐</i>}
        <b className="tc-voto">{p.voto.toFixed(1)}</b>
        {p.gol > 0 && <i className="tc-gol">⚽{p.gol > 1 ? `×${p.gol}` : ""}</i>}
      </span>
    </div>
  );
}

function BadgeRow({ badges }) {
  if (!badges.length) return null;
  return (
    <div className="badgerow">
      {badges.map((b) => (
        <span key={b.id} className={`badge ${b.tier}`} title={b.nome}>{b.icon} {b.nome}</span>
      ))}
    </div>
  );
}

function PremiRow({ premi }) {
  if (!premi.length) return null;
  return (
    <div className="badgerow">
      {premi.map((p) => (
        <span key={p.id} className="badge gold" title={`${p.tipo}${p.periodo ? ` · ${p.periodo}` : ""}`}>
          {p.emoji || "🏆"} {p.etichetta || p.tipo}
        </span>
      ))}
    </div>
  );
}

function MiniChart({ titolo, valori, colore, confronto }) {
  const punti = valori.map((v, i) => ({ v, i })).filter((p) => p.v != null);
  if (punti.length < 2) return null;

  const w = 600, h = 130, pad = 12;
  const vs = punti.map((p) => p.v);
  const min = Math.min(...vs), max = Math.max(...vs);
  const range = max - min || 1;
  const stepX = punti.length > 1 ? (w - pad * 2) / (punti.length - 1) : 0;
  const coords = punti.map((p, i) => [
    pad + i * stepX,
    pad + (1 - (p.v - min) / range) * (h - pad * 2),
  ]);
  const linePath = coords.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const areaPath = `${linePath} L${coords[coords.length - 1][0].toFixed(1)},${h - pad} L${coords[0][0].toFixed(1)},${h - pad} Z`;
  const gradId = `grad-${titolo.replace(/\s+/g, "")}`;

  return (
    <div className="chartbox">
      <h3>{titolo}</h3>
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="chartsvg">
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={colore} stopOpacity="0.35" />
            <stop offset="100%" stopColor={colore} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill={`url(#${gradId})`} />
        <path d={linePath} fill="none" stroke={colore} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        {coords.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={i === coords.length - 1 ? 4.5 : 2.5} fill={colore} />
        ))}
      </svg>
      {confronto && <div className="chartconfronto">{confronto}</div>}
    </div>
  );
}

/* ---------- dettaglio giocatore: riusato sia per il drill-down dalle liste, sia per "Tu" ---------- */
function DettaglioGiocatore({ s, players, S, VOTES, rel, PREMI, ruoloUtente, mostraMenu, xp }) {
  const badges = computeBadges(s, players);
  const premi = PREMI.filter((p) => p.giocatore_id === s.id);
  const { mean, std } = distribuzioneVoti(players);
  const andamento = computeAndamento(s.storico, mean, std);
  const confrontoTrend = (chiave, unita, decimali) => {
    const validi = andamento.filter((p) => p[chiave] != null);
    if (validi.length < 2) return null;
    const finestra = validi.slice(-5);
    const primo = finestra[0][chiave], ultimo = finestra[finestra.length - 1][chiave];
    const dir = ultimo > primo ? unita.su : ultimo < primo ? unita.giu : unita.pari;
    return `${unita.nome} ${dir} da ${primo.toFixed(decimali)} a ${ultimo.toFixed(decimali)} nelle ultime ${finestra.length} partite`;
  };
  const partner = bestPartner(s.id, rel);
  const nemesis = worstNemesis(s.id, rel);
  const fc = fanCritic(s.id, VOTES);

  return (
    <div className="detail">
      <PlayerCard s={s} badges={badges} livello={xp?.livello?.nome} />
      <div>
        {mostraMenu && xp && (
          <div className="xpcard">
            <div className="xp-top">
              <span className="xp-livello">{xp.livello.nome}</span>
              <span className="xp-totale"><b>{xp.totale}</b> XP totali (all-time)</span>
            </div>
            <div className="xpbar"><i style={{ width: `${Math.round(xp.livello.progresso * 100)}%` }} /></div>
            <div className="xp-prossimo">
              {xp.livello.prossimoNome
                ? `${xp.totale} / ${xp.livello.sogliaProssimo} XP verso "${xp.livello.prossimoNome}"`
                : "Livello massimo raggiunto 🏆"}
            </div>
            <div className="xp-ripartizione">
              <div><b>{xp.ripartizione.presenze || 0}</b><span>Presenze</span></div>
              <div><b>{xp.ripartizione.vittorie || 0}</b><span>Risultati</span></div>
              <div><b>{xp.ripartizione.gol || 0}</b><span>Gol</span></div>
              <div><b>{xp.ripartizione.assist || 0}</b><span>Assist</span></div>
              <div><b>{xp.ripartizione.mvp || 0}</b><span>MVP</span></div>
              <div><b>{xp.ripartizione.voto || 0}</b><span>Voti alti</span></div>
              <div><b>{xp.ripartizione.cleanSheet || 0}</b><span>Clean sheet</span></div>
            </div>
            <div className="xp-nota">XP cumulativo di tutte le stagioni — non cambia con il selettore stagione qui sopra.</div>
          </div>
        )}
        <div className="kv">
          <div className="stat"><b>{s.presenze}</b><span>Presenze</span></div>
          <div className="stat"><b>{s.w}-{s.d}-{s.l}</b><span>V-N-P</span></div>
          <div className="stat"><b>{s.gol}</b><span>Gol attribuiti</span></div>
          <div className="stat"><b>{s.mediaVoto.toFixed(2)}</b><span>Media voto</span></div>
          <div className="stat"><b>{s.mvp}</b><span>MVP</span></div>
          <div className="stat"><b>{Math.round(s.winRate * 100)}%</b><span>Win rate</span></div>
        </div>
        <BadgeRow badges={badges} />
        <PremiRow premi={premi} />

        <div className="grid2">
          <MiniChart titolo="📈 Andamento voto" colore="#E3C567"
            valori={andamento.map((p) => p.voto)}
            confronto={confrontoTrend("voto", { nome: "Media voto", su: "salita", giu: "scesa", pari: "stabile" }, 2)} />
          <MiniChart titolo="🎯 Andamento overall" colore="#5CBF7A"
            valori={andamento.map((p) => p.overall)}
            confronto={confrontoTrend("overall", { nome: "Overall", su: "salito", giu: "sceso", pari: "stabile" }, 0)} />
        </div>

        {fc && fc.nVoti > 0 && fc.fan && fc.critic && fc.fan.votante !== fc.critic.votante && S[fc.fan.votante] && S[fc.critic.votante] && (
          <div className="insight">
            🗳️ <b>{fc.nVoti} voti ricevuti.</b> Miglior fan: <b>{S[fc.fan.votante].nome}</b> (media {fc.fan.avg.toFixed(2)} in {fc.fan.n} voti).
            {" "}Critico più severo: <b>{S[fc.critic.votante].nome}</b> (media {fc.critic.avg.toFixed(2)} in {fc.critic.n} voti).
          </div>
        )}
        {partner && S[partner.mate] && (
          <div className="insight">
            👥 <b>Miglior coppia</b> — con <b>{S[partner.mate].nome}</b>: {partner.w} vittorie su {partner.games} partite insieme ({Math.round(partner.wr * 100)}%).
          </div>
        )}
        {nemesis && S[nemesis.opp] && (
          <div className="insight">
            😈 <b>Nemesi</b> — contro <b>{S[nemesis.opp].nome}</b> vince il {Math.round(nemesis.wr * 100)}% delle volte ({nemesis.w} su {nemesis.games}).
          </div>
        )}

        {mostraMenu && (
          <div className="menulist">
            <a className="menu-item" href="/profilo"><IconEdit /> Modifica profilo</a>
            <a className="menu-item" href="/privacy"><IconLock /> Privacy</a>
            <a className="menu-item" href="/crea-lega"><IconShield /> Crea una lega</a>
            {ruoloUtente === "admin" && <a className="menu-item" href="/admin"><IconMedal /> Admin<span className="hint">solo admin</span></a>}
            <button type="button" className="menu-item danger" onClick={() => supabase.auth.signOut()}><IconLogout /> Esci</button>
          </div>
        )}

        <h2>Storico partite</h2>
        <table className="storico">
          <thead><tr>
            <th>Data</th><th>Squadra</th><th>Risultato</th><th className="num">Voto</th><th className="num">Gol</th><th>Esito</th>
          </tr></thead>
          <tbody>
            {[...s.storico].reverse().map((r, i) => (
              <tr key={i} className="click" onClick={() => { window.location.href = `/partita/${r.match.dbId}`; }}>
                <td>{r.match.d}</td>
                <td>{r.team}</td>
                <td>{r.team} {r.score}</td>
                <td className="num">{r.voto ?? "—"}</td>
                <td className="num">{r.gol}</td>
                <td><span className={`dot ${r.esito}`} style={{ display: "inline-block", width: 10, height: 10, borderRadius: "50%" }} /> {r.esito === "W" ? "Vittoria" : r.esito === "L" ? "Sconfitta" : "Pareggio"}{r.match.mvp === s.id ? " · ⭐ MVP" : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function tradErroreAuth(msg) {
  const m = (msg || "").toLowerCase();
  if (m.includes("invalid login credentials")) return "Email o password errati.";
  if (m.includes("email not confirmed")) return "Email non ancora confermata: controlla la posta e clicca il link di conferma.";
  if (m.includes("user already registered") || m.includes("already registered")) return "Esiste già un account con questa email — prova ad accedere invece di registrarti.";
  if (m.includes("password should be at least") || m.includes("password is too short")) return "La password deve avere almeno 8 caratteri.";
  if (m.includes("rate limit") || m.includes("too many requests")) return "Troppi tentativi: riprova tra qualche minuto.";
  if (m.includes("unable to validate email") || m.includes("invalid email")) return "Indirizzo email non valido.";
  if (m.includes("same_password")) return "La nuova password deve essere diversa da quella attuale.";
  return msg;
}

const GOOGLE_ABILITATO = false;

function Login() {
  const [modo, setModo] = useState("password"); // "password" | "magic"
  const [azione, setAzione] = useState("accedi"); // "accedi" | "registrati" (solo modo password)
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mostraPassword, setMostraPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [sent, setSent] = useState(false);
  const [registrato, setRegistrato] = useState(false);
  const [resetInviato, setResetInviato] = useState(false);

  const passwordOk = password.length >= 8;

  const google = async () => {
    setErr("");
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: typeof window !== "undefined" ? window.location.origin : undefined },
    });
    if (error) setErr("Accesso Google non disponibile: " + tradErroreDb(error.message));
  };

  const inviaMagicLink = async () => {
    setBusy(true); setErr("");
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: typeof window !== "undefined" ? window.location.origin : undefined },
    });
    setBusy(false);
    if (error) setErr(tradErroreAuth(error.message)); else setSent(true);
  };

  const accedi = async () => {
    setBusy(true); setErr("");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) setErr(tradErroreAuth(error.message));
  };

  const registrati = async () => {
    if (!passwordOk) { setErr("La password deve avere almeno 8 caratteri."); return; }
    setBusy(true); setErr("");
    const { error } = await supabase.auth.signUp({
      email, password,
      options: { emailRedirectTo: typeof window !== "undefined" ? window.location.origin : undefined },
    });
    setBusy(false);
    if (error) setErr(tradErroreAuth(error.message)); else setRegistrato(true);
  };

  const chiediReset = async () => {
    if (!email) { setErr('Inserisci la tua email, poi clicca di nuovo su "Password dimenticata?".'); return; }
    setBusy(true); setErr("");
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: typeof window !== "undefined" ? `${window.location.origin}/reset` : undefined,
    });
    setBusy(false);
    if (error) setErr(tradErroreAuth(error.message)); else setResetInviato(true);
  };

  const submit = () => {
    if (modo === "magic") return inviaMagicLink();
    if (azione === "registrati") return registrati();
    return accedi();
  };

  if (registrato) {
    return (
      <div className="login">
        <h1>Scarsi <em>League</em></h1>
        <p className="msg">✉️ Quasi fatto! Controlla <b>{email}</b> e clicca il link per confermare l&apos;indirizzo, poi torna qui per accedere.</p>
      </div>
    );
  }
  if (sent) {
    return (
      <div className="login">
        <h1>Scarsi <em>League</em></h1>
        <p className="msg">✉️ Fatto! Controlla la tua email e clicca il link di accesso.</p>
      </div>
    );
  }
  if (resetInviato) {
    return (
      <div className="login">
        <h1>Scarsi <em>League</em></h1>
        <p className="msg">✉️ Ti abbiamo inviato un&apos;email per reimpostare la password. Controlla la posta.</p>
      </div>
    );
  }

  return (
    <div className="login">
      <h1>Scarsi <em>League</em></h1>
      <p className="season">Accesso riservato ai membri della lega</p>

      {GOOGLE_ABILITATO && (
        <>
          <button className="gbtn" onClick={google}>Continua con Google</button>
          <div className="divider"><span>oppure</span></div>
        </>
      )}

      {modo === "password" && (
        <span className="toggle authtoggle">
          <button className={azione === "accedi" ? "on" : ""} onClick={() => { setAzione("accedi"); setErr(""); }}>Accedi</button>
          <button className={azione === "registrati" ? "on" : ""} onClick={() => { setAzione("registrati"); setErr(""); }}>Registrati</button>
        </span>
      )}

      <input type="email" placeholder="la-tua-email@esempio.it" value={email}
        onChange={(e) => setEmail(e.target.value)} />

      {modo === "password" && (
        <>
          <div className="pwdfield">
            <input type={mostraPassword ? "text" : "password"} placeholder="Password" value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && email && password && submit()} />
            <button type="button" className="pwdtoggle" onClick={() => setMostraPassword((v) => !v)} aria-label="Mostra/nascondi password">
              {mostraPassword ? "🙈" : "👁"}
            </button>
          </div>
          {azione === "registrati" && password.length > 0 && !passwordOk && (
            <p className="msg">La password deve avere almeno 8 caratteri.</p>
          )}
        </>
      )}

      <button onClick={submit} disabled={busy || !email || (modo === "password" && !password)}>
        {busy ? "Un attimo…" : modo === "magic" ? "Inviami il link di accesso" : azione === "registrati" ? "Crea account" : "Accedi"}
      </button>

      {modo === "password" && azione === "accedi" && (
        <p className="msg"><a className="plink" href="#" onClick={(e) => { e.preventDefault(); chiediReset(); }}>Password dimenticata?</a></p>
      )}

      {err && <p className="msg">⚠ {err}</p>}

      <div className="divider"><span>oppure</span></div>
      <button type="button" className="linkbtn" onClick={() => { setModo(modo === "password" ? "magic" : "password"); setErr(""); }}>
        {modo === "password" ? "Accedi senza password" : "Accedi con password"}
      </button>

      <p className="msg">Continuando accetti la <a className="plink" href="/privacy">Privacy Policy</a> della lega.</p>
    </div>
  );
}

function RichiediAccesso({ email }) {
  const [nome, setNome] = useState("");
  const [messaggio, setMessaggio] = useState("");
  const [lega, setLega] = useState(undefined); // undefined=verifica, null=nessun invito, {id,nome}
  const [stato, setStato] = useState(null); // null=verifica, 'nuova', 'inviata', 'errore'
  const [err, setErr] = useState("");

  useEffect(() => {
    const slug = new URLSearchParams(window.location.search).get("lega");
    if (!slug) { setLega(null); setStato("nuova"); return; }
    supabase.rpc("lega_da_slug", { p_slug: slug }).then(({ data }) => {
      const l = (data || [])[0] || null;
      setLega(l);
      if (!l) { setStato("nuova"); return; }
      supabase.from("richieste_accesso").select("stato")
        .eq("email", (email || "").toLowerCase()).eq("lega_id", l.id).maybeSingle()
        .then(({ data: r }) => setStato(r ? "inviata" : "nuova"));
    });
  }, []);

  const invia = async () => {
    const { error } = await supabase.from("richieste_accesso").insert({
      email: (email || "").toLowerCase(), nome, messaggio, lega_id: lega.id,
    });
    if (error) { setErr(tradErroreDb(error.message)); setStato("errore"); }
    else setStato("inviata");
  };

  return (
    <div className="login">
      <h1>Scarsi <em>League</em></h1>
      {lega === undefined ? (
        <p className="msg">Verifica in corso…</p>
      ) : lega === null ? (
        <>
          <p className="season">Serve un invito</p>
          <p className="msg">
            L&apos;email <b>{email}</b> non è ancora tra i membri di nessuna lega.
            Chiedi il link di invito a chi organizza la tua lega (di solito è un QR code
            o un link con <code>?lega=...</code>).
          </p>
          <button onClick={() => supabase.auth.signOut()}>Esci</button>
        </>
      ) : stato === "inviata" ? (
        <>
          <p className="season">Richiesta inviata ✅</p>
          <p className="msg">
            L&apos;admin di <b>{lega.nome}</b> deve approvarti — di solito lo fa prima del
            fischio d&apos;inizio. Riapri il sito dopo l&apos;ok e sei dentro.
          </p>
          <button onClick={() => supabase.auth.signOut()}>Esci</button>
        </>
      ) : stato === "nuova" || stato === "errore" ? (
        <>
          <p className="season">Un ultimo passo</p>
          <p className="msg">
            L&apos;email <b>{email}</b> non è ancora tra i membri di <b>{lega.nome}</b>.
            Se giochi con loro, richiedi l&apos;accesso:
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
    if (error) setErr(tradErroreDb(error.message)); else onAccettato();
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
  const [mieMembri, setMieMembri] = useState([]); // righe membri_autorizzati dell'utente, una per lega
  const [leghe, setLeghe] = useState([]);
  const [legaId, setLegaId] = useState(null);
  const [stagioneId, setStagioneId] = useState(null); // null = non ancora scelta esplicitamente (default: stagione attiva)
  const [raw, setRaw] = useState(null);
  const [errore, setErrore] = useState("");

  const [sezione, setSezione] = useState("lega"); // lega | partite | classifiche | giocatori | tu
  const [legaSub, setLegaSub] = useState("panoramica"); // panoramica | totw
  const [classificheSub, setClassificheSub] = useState("generale"); // generale | specialita | record
  const [sel, setSel] = useState(null);
  const [totwId, setTotwId] = useState(null);
  const [soloRegulars, setSoloRegulars] = useState(true);

  // ---------- notifiche in-app (solo locali, nessun servizio esterno) ----------
  const [richiesteInAttesa, setRichiesteInAttesa] = useState(0);
  const [notificaPartite, setNotificaPartite] = useState(false);
  const [notificaPremio, setNotificaPremio] = useState(false);
  const [benvenutoVisibile, setBenvenutoVisibile] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => subscription.unsubscribe();
  }, []);

  // legge la sezione (e sotto-sezione) iniziali dalla URL, così i link da altre pagine funzionano
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sez = params.get("sezione");
    if (sez && SEZIONI_VALIDE.includes(sez)) setSezione(sez);
    const sub = params.get("sub");
    if (sub === "totw" && sez === "lega") setLegaSub("totw");
    if (sez === "classifiche" && ["generale", "specialita", "record"].includes(sub)) setClassificheSub(sub);
  }, []);

  useEffect(() => {
    if (!session) return;
    (async () => {
      // 1) consenso privacy registrato?
      const mailC = (session.user?.email || "").toLowerCase();
      const { data: c } = await supabase.from("consensi").select("email").eq("email", mailC).maybeSingle();
      if (!c) { setConsenso(false); return; }
      setConsenso(true);
      // 2) verifica whitelist: la RLS mostra solo le proprie righe (una per lega)
      const mail = (session.user?.email || "").toLowerCase();
      const { data: mie } = await supabase
        .from("membri_autorizzati")
        .select("email, lega_id, ruolo, giocatore_id")
        .eq("email", mail);
      if (!mie || !mie.length) { setAutorizzato(false); return; }
      setAutorizzato(true);
      setMieMembri(mie);
      const [pa, gi, pr, vo, le, st, dm, pre] = await Promise.all([
        supabase.from("partite").select("*"),
        supabase.from("giocatori").select("*"),
        supabase.from("prestazioni").select("*"),
        supabase.from("voti_ricevuti").select("*"),
        supabase.from("leghe").select("*").order("id"),
        supabase.from("stagioni").select("*").order("inizio", { ascending: false }),
        supabase.from("dati_manuali").select("*"),
        supabase.from("premi").select("*"),
      ]);
      const err = pa.error || gi.error || pr.error || vo.error;
      if (err) { setErrore(tradErroreDb(err.message)); return; }
      setLeghe(le.data || []);
      setLegaId((le.data || [])[0]?.id ?? null);
      setRaw({ pa: pa.data, gi: gi.data, pr: pr.data, vo: vo.data, st: st.data || [], dm: dm.data || [], premi: pre.data || [] });
    })();
  }, [session]);

  const stagioniLega = useMemo(() => (
    raw ? raw.st.filter((s) => s.lega_id === legaId).sort((a, b) => (a.inizio < b.inizio ? 1 : -1)) : []
  ), [raw, legaId]);
  const stagioneAttiva = stagioniLega.find((s) => s.attiva) || null;
  const stagioneSel = stagioneId ?? stagioneAttiva?.id ?? "all";

  const mioMembro = useMemo(() => mieMembri.find((m) => m.lega_id === legaId) || null, [mieMembri, legaId]);
  const ruoloUtente = mioMembro?.ruolo || "membro";
  const mioGiocatoreId = mioMembro?.giocatore_id ?? null;

  // richieste in attesa (solo per l'admin, per il pallino su "Tu")
  useEffect(() => {
    if (!legaId || ruoloUtente !== "admin") { setRichiesteInAttesa(0); return; }
    supabase.from("richieste_accesso").select("id", { count: "exact", head: true })
      .eq("lega_id", legaId).eq("stato", "in_attesa")
      .then(({ count }) => setRichiesteInAttesa(count || 0));
  }, [legaId, ruoloUtente]);

  // benvenuto la prima volta che si vede la lega da approvati (una volta per lega, per browser)
  useEffect(() => {
    if (autorizzato !== true || legaId == null) return;
    const chiave = `sl_benvenuto_${legaId}`;
    if (!localStorage.getItem(chiave)) {
      localStorage.setItem(chiave, "1");
      setBenvenutoVisibile(true);
    }
  }, [autorizzato, legaId]);

  // nuova partita importata (per pallino su "Partite"): confronta l'ultima
  // partita della lega con l'ultima vista salvata localmente
  useEffect(() => {
    if (!raw || legaId == null) { setNotificaPartite(false); return; }
    const pa = raw.pa.filter((p) => p.lega_id === legaId);
    if (!pa.length) { setNotificaPartite(false); return; }
    const ultima = [...pa].sort((a, b) => (a.data < b.data ? -1 : 1)).slice(-1)[0];
    setNotificaPartite(localStorage.getItem(`sl_ultima_partita_${legaId}`) !== String(ultima.id));
  }, [raw, legaId]);
  useEffect(() => {
    if (sezione !== "partite" || !raw || legaId == null) return;
    const pa = raw.pa.filter((p) => p.lega_id === legaId);
    if (!pa.length) return;
    const ultima = [...pa].sort((a, b) => (a.data < b.data ? -1 : 1)).slice(-1)[0];
    localStorage.setItem(`sl_ultima_partita_${legaId}`, String(ultima.id));
    setNotificaPartite(false);
  }, [sezione, raw, legaId]);

  // nuovo premio assegnato a me (per pallino su "Tu")
  useEffect(() => {
    if (!raw || legaId == null || mioGiocatoreId == null) { setNotificaPremio(false); return; }
    const miei = raw.premi.filter((p) => p.lega_id === legaId && p.giocatore_id === mioGiocatoreId);
    if (!miei.length) { setNotificaPremio(false); return; }
    const ultimo = [...miei].sort((a, b) => (a.assegnato_il < b.assegnato_il ? -1 : 1)).slice(-1)[0];
    setNotificaPremio(localStorage.getItem(`sl_ultimo_premio_${legaId}_${mioGiocatoreId}`) !== String(ultimo.id));
  }, [raw, legaId, mioGiocatoreId]);
  useEffect(() => {
    if (sezione !== "tu" || !raw || legaId == null || mioGiocatoreId == null) return;
    const miei = raw.premi.filter((p) => p.lega_id === legaId && p.giocatore_id === mioGiocatoreId);
    if (!miei.length) return;
    const ultimo = [...miei].sort((a, b) => (a.assegnato_il < b.assegnato_il ? -1 : 1)).slice(-1)[0];
    localStorage.setItem(`sl_ultimo_premio_${legaId}_${mioGiocatoreId}`, String(ultimo.id));
    setNotificaPremio(false);
  }, [sezione, raw, legaId, mioGiocatoreId]);

  const notifiche = { partite: notificaPartite, tu: (ruoloUtente === "admin" && richiesteInAttesa > 0) || notificaPremio };

  const data = useMemo(() => {
    if (!raw || legaId == null) return null;
    const gi = raw.gi.filter((g) => g.lega_id === legaId);
    const pa = raw.pa.filter((p) => p.lega_id === legaId && (stagioneSel === "all" || p.stagione_id === stagioneSel));
    const paIds = new Set(pa.map((p) => p.id));
    const pr = raw.pr.filter((p) => paIds.has(p.partita_id));
    const vo = raw.vo.filter((v) => paIds.has(v.partita_id));
    const dm = raw.dm.filter((d) => paIds.has(d.partita_id));
    const premi = raw.premi.filter((p) => p.lega_id === legaId);
    if (!pa.length) return { P: {}, matches: [], votes: [], dm: [], premi: [], vuota: true };
    return { ...assemble(pa, gi, pr, vo), dm, premi };
  }, [raw, legaId, stagioneSel]);
  const S = useMemo(() => (data && !data.vuota ? buildStats(data.P, data.matches) : null), [data]);
  const rel = useMemo(() => (data ? pairAndNemesis(data.matches) : null), [data]);

  // XP: sempre all-time, mai filtrato per stagione (è la progressione del giocatore).
  const dataAllTime = useMemo(() => {
    if (!raw || legaId == null) return null;
    const gi = raw.gi.filter((g) => g.lega_id === legaId);
    const pa = raw.pa.filter((p) => p.lega_id === legaId);
    if (!pa.length) return null;
    const paIds = new Set(pa.map((p) => p.id));
    const pr = raw.pr.filter((p) => paIds.has(p.partita_id));
    const vo = raw.vo.filter((v) => paIds.has(v.partita_id));
    return assemble(pa, gi, pr, vo);
  }, [raw, legaId]);
  const SAllTime = useMemo(() => (dataAllTime ? buildStats(dataAllTime.P, dataAllTime.matches) : null), [dataAllTime]);
  const dmAllTimeByChiave = useMemo(() => {
    const m = {};
    (raw?.dm || []).forEach((d) => { m[`${d.partita_id}_${d.giocatore_id}`] = d; });
    return m;
  }, [raw]);
  const xpDiGiocatore = (id) => {
    const s = SAllTime?.[id];
    if (!s || !s.storico?.length) return { totale: 0, ripartizione: {}, livello: computeLivello(0) };
    const { totale, ripartizione } = computeXP(s, dmAllTimeByChiave);
    return { totale, ripartizione, livello: computeLivello(totale) };
  };

  const naviga = (key) => {
    setSel(null);
    setSezione(key);
    if (key === "lega") setLegaSub("panoramica");
    if (key === "classifiche") setClassificheSub("generale");
    window.history.pushState(null, "", `/?sezione=${key}`);
  };
  const scegliLegaSub = (k) => { setLegaSub(k); setSel(null); window.history.replaceState(null, "", `/?sezione=lega&sub=${k}`); };
  const scegliClassificheSub = (k) => { setClassificheSub(k); setSel(null); window.history.replaceState(null, "", `/?sezione=classifiche&sub=${k}`); };

  if (session === undefined) return <div className="centered">Caricamento…</div>;
  if (!session) return <Login />;
  if (consenso === false) {
    return <Consenso email={session.user?.email} onAccettato={() => { setConsenso(true); window.location.reload(); }} />;
  }
  if (autorizzato === false) {
    return <RichiediAccesso email={session.user?.email} />;
  }
  if (errore) return (
    <div className="centered">
      Non siamo riusciti a caricare i dati della lega.<br />
      <span style={{ fontSize: 12, opacity: .7 }}>{errore}</span><br />
      <a className="plink" href="/">Riprova</a>
    </div>
  );

  const mioIniziali = () => {
    if (!mioGiocatoreId || !S) return (session.user?.email || "?").slice(0, 2).toUpperCase();
    const p = S[mioGiocatoreId];
    if (!p) return (session.user?.email || "?").slice(0, 2).toUpperCase();
    return (p.nick || p.nome).split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  };

  if (data?.vuota) {
    const mioAllTime = mioGiocatoreId != null && SAllTime ? SAllTime[mioGiocatoreId] : null;
    const mostraTuAllTime = sezione === "tu" && mioAllTime && mioAllTime.presenze > 0;
    const legaCorrente = leghe.find((l) => l.id === legaId);
    const linkInvito = legaCorrente ? `${typeof window !== "undefined" ? window.location.origin : ""}/?lega=${legaCorrente.slug}` : "";
    return (
      <>
        <AppNav active={sezione} onNavigate={naviga} iniziali={mioIniziali()} notifiche={notifiche} />
        <div className="wrap navpad">
          <div className="brand"><h1>Scarsi <em>League</em></h1></div>
          <ContextBar stagioni={stagioniLega} stagioneSel={stagioneSel}
            onStagioneChange={(v) => setStagioneId(v)}
            leghe={leghe.length > 1 ? leghe : null} legaId={legaId}
            onLegaChange={(id) => { setLegaId(id); setStagioneId(null); }} />
          {mostraTuAllTime ? (
            <>
              <h2>La tua bacheca</h2>
              <div className="note">La stagione selezionata sopra è vuota: qui sotto vedi le tue statistiche e il tuo XP di tutte le stagioni.</div>
              <DettaglioGiocatore s={mioAllTime}
                players={Object.values(SAllTime).filter((p) => p.presenze > 0)}
                S={SAllTime} VOTES={dataAllTime.votes} rel={pairAndNemesis(dataAllTime.matches)}
                PREMI={raw.premi.filter((p) => p.lega_id === legaId)}
                ruoloUtente={ruoloUtente} mostraMenu xp={xpDiGiocatore(mioGiocatoreId)} />
            </>
          ) : sezione !== "tu" || mioGiocatoreId != null ? (
            stagioneSel !== "all" && stagioneSel === stagioneAttiva?.id ? (
              <p className="centered">{`La stagione ${stagioneAttiva.nome} inizia a breve ⚽`}</p>
            ) : ruoloUtente === "admin" ? (
              <div className="wrap" style={{ maxWidth: 480, paddingLeft: 0, paddingRight: 0 }}>
                <p className="season">Sei admin qui — un paio di cose per partire</p>
                <p className="msg">
                  <b>Invita i tuoi amici</b> con questo link, li porta dritti alla richiesta di accesso:
                </p>
                <p className="msg"><code>{linkInvito}</code></p>
                <CopyButton text={linkInvito} label="📋 Copia link di invito" />
                <p className="msg" style={{ marginTop: 18 }}>
                  Quando hai i dati Fubles della prima partita, <a className="plink" href="/admin">importali dal pannello admin</a>.
                </p>
              </div>
            ) : (
              <p className="centered">Questa lega non ha ancora partite importate ⚽</p>
            )
          ) : (
            <p className="centered">
              Non hai ancora collegato una scheda giocatore.<br /><a className="plink" href="/profilo">Vai al tuo profilo</a> per collegarla.
            </p>
          )}
        </div>
      </>
    );
  }
  if (!data || !S) return <div className="centered">Caricamento…</div>;

  const { matches: MATCHES, votes: VOTES, dm: DM, premi: PREMI } = data;
  const players = Object.values(S).filter((p) => p.presenze > 0);
  const shown = soloRegulars ? players.filter((p) => p.presenze >= 2) : players;
  const classifica = [...shown].sort((a, b) => b.punti - a.punti || b.mediaVoto - a.mediaVoto);
  const last = MATCHES[MATCHES.length - 1];
  const lastTeams = Object.keys(last.teams);
  const totwMatch = MATCHES.find((m) => m.dbId === totwId) || last;
  const totw = buildTOTW(totwMatch, S);
  const totGol = MATCHES.reduce((a, m) => a + Object.values(m.score).reduce((x, y) => x + y, 0), 0);
  const golAttribuiti = players.reduce((a, p) => a + p.gol, 0);
  const capocannoniere = [...players].sort((a, b) => b.gol - a.gol)[0];
  const topVoto = [...players].filter((p) => p.presenze >= 2).sort((a, b) => b.mediaVoto - a.mediaVoto)[0];
  const topMvp = [...players].sort((a, b) => b.mvp - a.mvp || b.mediaVoto - a.mediaVoto)[0];

  const assistTotali = {};
  const cleanSheetTotali = {};
  DM.forEach((d) => {
    if (d.assist) assistTotali[d.giocatore_id] = (assistTotali[d.giocatore_id] || 0) + d.assist;
    if (d.clean_sheet) cleanSheetTotali[d.giocatore_id] = (cleanSheetTotali[d.giocatore_id] || 0) + 1;
  });

  const potmDati = computePlayerOfTheMonth(MATCHES);
  const potm = potmDati ? S[potmDati.id] : null;

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
  const mioStats = mioGiocatoreId != null ? players.find((p) => p.id === mioGiocatoreId) : null;

  const legaCorrente = leghe.find((l) => l.id === legaId);

  return (
    <>
      <AppNav active={sezione} onNavigate={naviga} iniziali={mioIniziali()} notifiche={notifiche} />
      <div className="wrap navpad">
        <header>
          <div className="brand">
            <h1>Scarsi <em>League</em></h1>
            <span className="season">{legaCorrente?.nome}{legaCorrente?.struttura ? ` · ${legaCorrente.struttura}` : ""}</span>
          </div>
          <span className="livebadge">● DATI LIVE DA SUPABASE</span>
        </header>

        {benvenutoVisibile && (
          <div className="note" style={{ marginBottom: 12 }}>
            🎉 Sei dentro <b>{legaCorrente?.nome}</b>! Dai un&apos;occhiata in giro.
            <button type="button" className="mini" style={{ marginLeft: 10 }} onClick={() => setBenvenutoVisibile(false)}>Ok</button>
          </div>
        )}

        <ContextBar stagioni={stagioniLega} stagioneSel={stagioneSel}
          onStagioneChange={(v) => setStagioneId(v)}
          leghe={leghe.length > 1 ? leghe : null} legaId={legaId}
          onLegaChange={(id) => { setLegaId(id); setStagioneId(null); }} />

        {sel == null && sezione === "lega" && (
          <>
            <SubTabs active={legaSub} onSelect={scegliLegaSub} tabs={[
              { key: "panoramica", label: "Panoramica" },
              { key: "totw", label: "Team of the Week" },
              { key: "hof", label: "Hall of Fame", href: "/hall-of-fame" },
            ]} />

            {legaSub === "panoramica" && (
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

                {potm && potmDati && (
                  <>
                    <h2>🏅 Player of the Month · {MESI_LUNGHI[new Date().getMonth()]}</h2>
                    <div className="potmcard">
                      <div className="potm-wrap">
                        <span className="potm-ribbon">🏅 POTM</span>
                        <PlayerCard s={potm} badges={computeBadges(potm, players)} livello={xpDiGiocatore(potm.id).livello.nome} onClick={() => setSel(potm.id)} />
                      </div>
                      <div className="potm-stats">
                        <div className="stat"><b>{potmDati.mediaVoto.toFixed(2)}</b><span>Media voto del mese</span></div>
                        <div className="stat"><b>{potmDati.presenze}</b><span>Presenze nel mese</span></div>
                        <div className="stat"><b>{Math.round(potmDati.winRate * 100)}%</b><span>Win rate nel mese</span></div>
                        {potmDati.mvp > 0 && <div className="stat"><b>{potmDati.mvp}</b><span>MVP nel mese</span></div>}
                      </div>
                    </div>
                  </>
                )}

                <div className="strip">
                  <div className="stat"><b>{MATCHES.length}</b><span>Partite</span></div>
                  <div className="stat"><b>{players.length}</b><span>Giocatori</span></div>
                  <div className="stat"><b>{totGol}</b><span>Gol totali</span></div>
                  <div className="stat"><b>{(totGol / MATCHES.length).toFixed(1)}</b><span>Gol / partita</span></div>
                  <div className="stat"><b>{VOTES.length}</b><span>Voti espressi</span></div>
                </div>
                <div className="note">⚠ Marcatori attribuiti su Fubles: {golAttribuiti} gol su {totGol} totali — classifiche marcatori parziali.</div>

                <h2>AI Insight della settimana</h2>
                <div className="insight">
                  <b>{topVoto.nome}</b> ha la miglior media voto tra i regulars ({topVoto.mediaVoto.toFixed(2)} in {topVoto.presenze} partite).
                  {" "}<b>{capocannoniere.nome}</b> guida i marcatori con {capocannoniere.gol} gol attribuiti.
                  {" "}<b>{topMvp.nome}</b> è il giocatore col maggior numero di premi MVP ({topMvp.mvp}).
                </div>
              </>
            )}

            {legaSub === "totw" && (
              <>
                <h2>Team of the Week
                  <select className="legasel" value={totwMatch.dbId} onChange={(e) => setTotwId(Number(e.target.value))}>
                    {[...MATCHES].reverse().map((m) => {
                      const t = Object.keys(m.teams);
                      return <option key={m.dbId} value={m.dbId}>{m.d} · {t[0]} {m.score[t[0]]}-{m.score[t[1]]} {t[1]}</option>;
                    })}
                  </select>
                </h2>
                {totw.adattata && (
                  <div className="note">⚠ Ruoli insufficienti per la 1-3-3-1: schierati i migliori voti disponibili a prescindere dal ruolo.</div>
                )}
                {totw.disponibili === 0 ? (
                  <p className="season">Nessun voto disponibile per questa partita.</p>
                ) : (
                  <div className="pitch">
                    <div className="pitch-header">
                      <span className="pitch-logo">Scarsi <em>League</em></span>
                      <h3 className="pitch-title">Team of the Week · {totwMatch.d}</h3>
                    </div>
                    <div className="pitch-bande">
                      <div className="pitch-lines" aria-hidden="true">
                        <span className="pl-half" />
                        <span className="pl-circle" />
                        <span className="pl-box pl-box-top" />
                        <span className="pl-box pl-box-bottom" />
                      </div>
                      {["ATT", "CEN", "DIF", "POR"].map((r) => (
                        <div key={r} className="banda">
                          {totw.bande[r].map((p) => <TotwCard key={p.id} p={p} />)}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {sel == null && sezione === "partite" && (
          <>
            <h2>Partite della stagione</h2>
            {MATCHES.length === 0 ? (
              <p className="season">Nessuna partita in questa stagione.</p>
            ) : (
              <div className="matchlist">
                {[...MATCHES].reverse().map((m) => {
                  const t = Object.keys(m.teams);
                  return (
                    <a key={m.dbId} className="matchcard" href={`/partita/${m.dbId}`}>
                      <span className="mc-data">{m.d}</span>
                      <span className="mc-mid"><span>{t[0]}</span><span>{m.score[t[0]]}–{m.score[t[1]]}</span><span>{t[1]}</span></span>
                      <span className="mc-arrow">→</span>
                    </a>
                  );
                })}
              </div>
            )}
          </>
        )}

        {sel == null && sezione === "classifiche" && (
          <>
            <SubTabs active={classificheSub} onSelect={scegliClassificheSub} tabs={[
              { key: "generale", label: "Generale" },
              { key: "specialita", label: "Specialità" },
              { key: "record", label: "Record" },
            ]} />

            {classificheSub === "generale" && (
              <>
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
              </>
            )}

            {classificheSub === "specialita" && (
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
                {Object.keys(assistTotali).length > 0 && (
                  <MiniTable title="🅰️ Assist" note="Dati inseriti a mano dall'admin"
                    cols={["Giocatore", "Assist", "Pres."]}
                    rows={Object.entries(assistTotali).sort((a, b) => b[1] - a[1]).slice(0, 8)
                      .map(([gid, n]) => [S[gid]?.nome || "—", n, S[gid]?.presenze || 0])} />
                )}
                {Object.keys(cleanSheetTotali).length > 0 && (
                  <MiniTable title="🧤 Clean sheet" note="Dati inseriti a mano dall'admin"
                    cols={["Giocatore", "Clean sheet", "Pres."]}
                    rows={Object.entries(cleanSheetTotali).sort((a, b) => b[1] - a[1]).slice(0, 8)
                      .map(([gid, n]) => [S[gid]?.nome || "—", n, S[gid]?.presenze || 0])} />
                )}
                {SAllTime && (
                  <MiniTable title="🎮 Classifica XP" note="Cumulativa all-time, non filtrata per stagione"
                    cols={["Giocatore", "XP", "Livello"]}
                    rows={Object.values(SAllTime).filter((p) => p.presenze > 0)
                      .map((p) => ({ p, xp: xpDiGiocatore(p.id) }))
                      .sort((a, b) => b.xp.totale - a.xp.totale).slice(0, 8)
                      .map(({ p, xp }) => [p.nome, xp.totale, xp.livello.nome])} />
                )}
              </div>
            )}

            {classificheSub === "record" && (
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
            )}
          </>
        )}

        {sel == null && sezione === "giocatori" && (
          <>
            <h2>Rose e carte
              <span className="toggle">
                <button className={soloRegulars ? "on" : ""} onClick={() => setSoloRegulars(true)}>Regulars ≥2</button>
                <button className={!soloRegulars ? "on" : ""} onClick={() => setSoloRegulars(false)}>Tutti ({players.length})</button>
              </span>
            </h2>
            <div className="grid">
              {[...shown].sort((a, b) => b.overall - a.overall).map((p) => (
                <PlayerCard key={p.id} s={p} badges={computeBadges(p, players)} livello={xpDiGiocatore(p.id).livello.nome} onClick={() => setSel(p.id)} />
              ))}
            </div>
          </>
        )}

        {sel == null && sezione === "tu" && (
          mioGiocatoreId == null ? (
            <div className="centered" style={{ padding: "12vh 0" }}>
              Non hai ancora collegato una scheda giocatore.<br />
              <a className="plink" href="/profilo">Vai al tuo profilo</a> per collegarla.
            </div>
          ) : !mioStats ? (
            <div className="centered" style={{ padding: "12vh 0" }}>
              Nessuna presenza tua in questa lega/stagione selezionata.<br />
              <a className="plink" href="#" onClick={(e) => { e.preventDefault(); setStagioneId("all"); }}>Prova con "Tutte le stagioni"</a>
            </div>
          ) : (
            <>
              <h2>La tua bacheca</h2>
              <DettaglioGiocatore s={mioStats} players={players} S={S} VOTES={VOTES} rel={rel} PREMI={PREMI}
                ruoloUtente={ruoloUtente} mostraMenu xp={xpDiGiocatore(mioStats.id)} />
            </>
          )
        )}

        {selS && (
          <>
            <button className="back" onClick={() => setSel(null)}>← Indietro</button>
            <DettaglioGiocatore s={selS} players={players} S={S} VOTES={VOTES} rel={rel} PREMI={PREMI}
              ruoloUtente={ruoloUtente} mostraMenu={false} xp={xpDiGiocatore(selS.id)} />
          </>
        )}
      </div>
    </>
  );
}
