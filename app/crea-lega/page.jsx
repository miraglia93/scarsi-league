"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { tradErroreDb } from "../../lib/engine";
import AppNav from "../../components/AppNav";

export default function CreaLega() {
  const [stato, setStato] = useState("verifica"); // verifica | no-login | ok
  const [piattaforma, setPiattaforma] = useState(null); // riga utenti_piattaforma o null
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const [nome, setNome] = useState("");
  const [slug, setSlug] = useState("");
  const [struttura, setStruttura] = useState("");
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
      p_nome: nome, p_slug: slug.toLowerCase(), p_struttura: struttura || null,
    });
    setBusy(false);
    if (error) { setMsg("⚠ " + tradErroreDb(error.message)); return; }
    setLegaCreata({ id: data, nome, slug: slug.toLowerCase() });
  };

  if (stato === "verifica") return <div className="centered">Caricamento…</div>;
  if (stato === "no-login") return <div className="centered"><a className="plink" href="/">Fai login per continuare</a></div>;

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
            <p className="msg">✅ Lega <b>{legaCreata.nome}</b> creata! Condividi questo link con i tuoi amici perché possano richiedere l&apos;accesso:</p>
            <p className="msg"><code>{typeof window !== "undefined" ? window.location.origin : ""}/?lega={legaCreata.slug}</code></p>
            <a className="plink" href="/">Vai alla tua nuova lega →</a>
          </>
        ) : piattaforma?.abbonamento_attivo ? (
          <>
            <p className="msg">Abbonamento attivo ✅ — crea la tua lega, dentro potrai gestire stagioni, partite e classifiche come già facciamo per Calci8Lunedì.</p>
            <input placeholder="Nome — es. Champions del Giovedì" value={nome} onChange={(e) => setNome(e.target.value)} />
            <input placeholder="Slug per l'invito — es. champions-giovedi" value={slug} onChange={(e) => setSlug(e.target.value)} />
            <input placeholder="Struttura sportiva (opzionale)" value={struttura} onChange={(e) => setStruttura(e.target.value)} />
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
