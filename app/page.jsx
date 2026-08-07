"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { assemble, buildStats, pairAndNemesis, bestPartner, worstNemesis, fanCritic, buildTOTW, computeBadges } from "../lib/engine";
import PlayerCard from "../components/PlayerCard";
import FormaDots from "../components/FormaDots";
import MiniTable from "../components/MiniTable";

/* ============================================================
   SCARSI LEAGUE — Next.js + Supabase (dati live)
   ============================================================ */

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
    if (error) setErr("Accesso Google non disponibile: " + error.message);
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

      <button className="gbtn" onClick={google}>Continua con Google</button>
      <div className="divider"><span>oppure</span></div>

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
  const [stagioneId, setStagioneId] = useState(null); // null = non ancora scelta esplicitamente (default: stagione attiva)
  const [raw, setRaw] = useState(null);
  const [errore, setErrore] = useState("");
  const [view, setView] = useState("home");
  const [sel, setSel] = useState(null);
  const [totwId, setTotwId] = useState(null);
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
      const [pa, gi, pr, vo, le, st] = await Promise.all([
        supabase.from("partite").select("*"),
        supabase.from("giocatori").select("*"),
        supabase.from("prestazioni").select("*"),
        supabase.from("voti_ricevuti").select("*"),
        supabase.from("leghe").select("*").order("id"),
        supabase.from("stagioni").select("*").order("inizio", { ascending: false }),
      ]);
      const err = pa.error || gi.error || pr.error || vo.error;
      if (err) { setErrore(err.message); return; }
      setLeghe(le.data || []);
      setLegaId((le.data || [])[0]?.id ?? null);
      setRaw({ pa: pa.data, gi: gi.data, pr: pr.data, vo: vo.data, st: st.data || [] });
    })();
  }, [session]);

  const stagioniLega = useMemo(() => (
    raw ? raw.st.filter((s) => s.lega_id === legaId).sort((a, b) => (a.inizio < b.inizio ? 1 : -1)) : []
  ), [raw, legaId]);
  const stagioneAttiva = stagioniLega.find((s) => s.attiva) || null;
  const stagioneSel = stagioneId ?? stagioneAttiva?.id ?? "all";
  const selettoreStagione = stagioniLega.length > 0 && (
    <select className="legasel" value={stagioneSel} onChange={(e) => setStagioneId(e.target.value === "all" ? "all" : Number(e.target.value))}>
      <option value="all">Tutte le stagioni</option>
      {stagioniLega.map((s) => <option key={s.id} value={s.id}>{s.nome}{s.attiva ? " · in corso" : ""}</option>)}
    </select>
  );

  const data = useMemo(() => {
    if (!raw || legaId == null) return null;
    const gi = raw.gi.filter((g) => g.lega_id === legaId);
    const pa = raw.pa.filter((p) => p.lega_id === legaId && (stagioneSel === "all" || p.stagione_id === stagioneSel));
    const paIds = new Set(pa.map((p) => p.id));
    const pr = raw.pr.filter((p) => paIds.has(p.partita_id));
    const vo = raw.vo.filter((v) => paIds.has(v.partita_id));
    if (!pa.length) return { P: {}, matches: [], votes: [], vuota: true };
    return assemble(pa, gi, pr, vo);
  }, [raw, legaId, stagioneSel]);
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
          <select className="legasel" value={legaId ?? ""} onChange={(e) => { setLegaId(Number(e.target.value)); setStagioneId(null); }}>
            {leghe.map((l) => <option key={l.id} value={l.id}>{l.nome}</option>)}
          </select>
        )}
        {selettoreStagione}
        <a className="navlink" href="/profilo">Profilo</a>
        <a className="navlink" href="/hall-of-fame">Hall of Fame</a>
        {ruoloUtente === "admin" && <a className="navlink" href="/admin">Admin</a>}
      </nav>
      <p className="centered">
        {stagioneSel !== "all" && stagioneSel === stagioneAttiva?.id
          ? `La stagione ${stagioneAttiva.nome} inizia a breve ⚽`
          : "Questa lega non ha ancora partite importate ⚽"}
      </p>
    </div>
  );
  if (!data || !S) return <div className="centered">Carico le partite…</div>;

  const { matches: MATCHES, votes: VOTES } = data;
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
  const selBadges = selS ? computeBadges(selS, players) : [];

  return (
    <div className="wrap">
      <header>
        <div className="brand">
          <h1>Scarsi <em>League</em></h1>
          <span className="season">Calci8Lunedì · Bettinelli · {stagioneSel === "all" ? "Tutte le stagioni" : (stagioniLega.find((s) => s.id === stagioneSel)?.nome || "")}</span>
        </div>
        <span className="livebadge">● DATI LIVE DA SUPABASE</span>
      </header>

      <nav>
        {[["home", "Home"], ["classifiche", "Classifiche"], ["giocatori", "Giocatori"], ["record", "Record"], ["totw", "TOTW"]].map(([k, l]) => (
          <button key={k} className={view === k && sel == null ? "on" : ""} onClick={() => { setView(k); setSel(null); }}>{l}</button>
        ))}
        {leghe.length > 1 && (
          <select className="legasel" value={legaId ?? ""} onChange={(e) => { setLegaId(Number(e.target.value)); setStagioneId(null); }}>
            {leghe.map((l) => <option key={l.id} value={l.id}>{l.nome}</option>)}
          </select>
        )}
        {selettoreStagione}
        <a className="navlink" href="/profilo">Profilo</a>
        <a className="navlink" href="/hall-of-fame">Hall of Fame</a>
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
              <PlayerCard key={p.id} s={p} badges={computeBadges(p, players)} onClick={() => setSel(p.id)} />
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

      {sel == null && view === "totw" && (
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

      {selS && (
        <>
          <button className="back" onClick={() => setSel(null)}>← Indietro</button>
          <div className="detail">
            <PlayerCard s={selS} badges={selBadges} />
            <div>
              <div className="kv">
                <div className="stat"><b>{selS.presenze}</b><span>Presenze</span></div>
                <div className="stat"><b>{selS.w}-{selS.d}-{selS.l}</b><span>V-N-P</span></div>
                <div className="stat"><b>{selS.gol}</b><span>Gol attribuiti</span></div>
                <div className="stat"><b>{selS.mediaVoto.toFixed(2)}</b><span>Media voto</span></div>
                <div className="stat"><b>{selS.mvp}</b><span>MVP</span></div>
                <div className="stat"><b>{Math.round(selS.winRate * 100)}%</b><span>Win rate</span></div>
              </div>
              <BadgeRow badges={selBadges} />

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
