"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { tradErroreDb } from "../../lib/engine";
import AppNav from "../../components/AppNav";
import CopyButton from "../../components/CopyButton";
import CodiceQR from "../../components/CodiceQR";

export default function CreaLega() {
  const [stato, setStato] = useState("verifica"); // verifica | no-login | ok
  const [piattaforma, setPiattaforma] = useState(null); // riga utenti_piattaforma o null
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const [nome, setNome] = useState("");
  const [slug, setSlug] = useState("");
  const [struttura, setStruttura] = useState("");
  const [orario, setOrario] = useState("");
  const [legaCreata, setLegaCreata] = useState(null);

  const carica = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setStato("no-login"); return; }
    const { data: p } = await supabase.from("utenti_piattaforma")
      .select("*").eq("email", (user.email || "").toLowerCase()).maybeSingle();
    setPiattaforma(p || null);
    setStato("ok");
  };

  useEffect(() => { carica(); }, []);

  const richiediAbbonamento = async () => {
    setBusy(true); setMsg("");
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("utenti_piattaforma").upsert({
      email: (user.email || "").toLowerCase(),
    }, { onConflict: "email" });
    setBusy(false);
    setMsg(error ? "⚠ " + tradErroreDb(error.message) : "✅ Richiesta registrata — ti contattiamo per attivarlo.");
    if (!error) carica();
  };

  const creaLega = async () => {
    setBusy(true); setMsg("");
    const { data, error } = await supabase.rpc("crea_lega", {
      p_nome: nome, p_slug: slug.toLowerCase(), p_struttura: struttura || null, p_orario: orario || null,
    });
    setBusy(false);
    if (error) { setMsg("⚠ " + tradErroreDb(error.message)); return; }
    setLegaCreata({ id: data, nome, slug: slug.toLowerCase() });
  };

  if (stato === "verifica") return <div className="centered">Caricamento…</div>;
  if (stato === "no-login") return <div className="centered"><a className="plink" href="/">Fai login per continuare</a></div>;

  const linkInvito = legaCreata
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/?lega=${legaCreata.slug}`
    : "";

  return (
    <>
      <AppNav active="tu" />
      <div className="wrap navpad" style={{ maxWidth: 560 }}>
        <div className="brand">
          <h1>Crea la tua <em>Lega</em></h1>
          <span className="season"><a className="plink" href="/?sezione=tu">← Torna alla bacheca</a></span>
        </div>

        {legaCreata ? (
          <>
            <p className="msg">✅ Lega <b>{legaCreata.nome}</b> creata, con la prima stagione già pronta. Tre passi per partire:</p>
            <div className="betaform">
              <p className="msg"><b>1. Invita i tuoi amici</b> — mandagli questo link, li porta dritti alla richiesta di accesso:</p>
              <p className="msg"><code>{linkInvito}</code></p>
              <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
                <CopyButton text={linkInvito} label="📋 Copia link di invito" />
              </div>
              <div style={{ marginTop: 14 }}>
                <CodiceQR testo={linkInvito} dimensione={160} />
                <p className="msg" style={{ fontSize: 12, opacity: .7, marginTop: 6 }}>
                  Stampalo o mostralo al campo — chi lo inquadra atterra dritto sulla richiesta di accesso.
                </p>
              </div>
              <p className="msg" style={{ marginTop: 18 }}><b>2. Approva le richieste</b> man mano che arrivano, dal pannello admin.</p>
              <p className="msg"><b>3. Importa la prima partita</b> quando hai i dati Fubles, sempre dal pannello admin.</p>
              <a className="plink" href="/admin" style={{ display: "inline-block", marginTop: 10 }}>Vai al pannello admin →</a>
            </div>
            <a className="plink" href="/" style={{ display: "inline-block", marginTop: 16 }}>Vai alla tua nuova lega →</a>
          </>
        ) : piattaforma?.abbonamento_attivo ? (
          <>
            <p className="msg">Abbonamento attivo ✅ — crea la tua lega, dentro potrai gestire stagioni, partite e classifiche come già facciamo per Calci8Lunedì.</p>
            <input placeholder="Nome — es. Champions del Giovedì" value={nome} onChange={(e) => setNome(e.target.value)} />
            <input placeholder="Slug per l'invito — es. champions-giovedi" value={slug} onChange={(e) => setSlug(e.target.value)} />
            <input placeholder="Struttura sportiva (opzionale)" value={struttura} onChange={(e) => setStruttura(e.target.value)} />
            <input placeholder="Orario — es. Lunedì · 21:30 (opzionale)" value={orario} onChange={(e) => setOrario(e.target.value)} />
            <button onClick={creaLega} disabled={busy || !nome || !slug}>{busy ? "Un attimo…" : "Crea la lega"}</button>
            {msg && <p className="msg">{msg}</p>}
          </>
        ) : (
          <>
            <p className="msg">
              Creare una lega richiede un abbonamento attivo — al momento lo attiviamo
              manualmente, presto sarà self-service.
            </p>
            <button onClick={richiediAbbonamento} disabled={busy}>
              {busy ? "Un attimo…" : piattaforma ? "Richiesta già inviata" : "Richiedi l'abbonamento"}
            </button>
            {msg && <p className="msg">{msg}</p>}
          </>
        )}
      </div>
    </>
  );
}
