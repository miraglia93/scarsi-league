"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

export default function Admin() {
  const [stato, setStato] = useState("verifica"); // verifica | no-login | no-admin | ok
  const [richieste, setRichieste] = useState([]);
  const [membri, setMembri] = useState([]);
  const [leghe, setLeghe] = useState([]);
  const [msg, setMsg] = useState("");
  const [nomeLega, setNomeLega] = useState("");
  const [slugLega, setSlugLega] = useState("");

  const carica = async () => {
    const [r, m, l] = await Promise.all([
      supabase.from("richieste_accesso").select("*").order("richiesta_il", { ascending: false }),
      supabase.from("membri_autorizzati").select("*").order("aggiunto_il"),
      supabase.from("leghe").select("*").order("id"),
    ]);
    setRichieste(r.data || []);
    setMembri(m.data || []);
    setLeghe(l.data || []);
  };

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setStato("no-login"); return; }
      const { data: me } = await supabase.from("membri_autorizzati").select("ruolo").maybeSingle();
      if (me?.ruolo !== "admin") { setStato("no-admin"); return; }
      setStato("ok");
      carica();
    })();
  }, []);

  const azione = async (fn, email) => {
    setMsg("");
    const { data, error } = await supabase.rpc(fn, { p_email: email });
    if (error || data !== "ok") setMsg("⚠ " + (error?.message || data));
    else setMsg("✅ Fatto");
    carica();
  };

  const revoca = async (email) => {
    if (!confirm(`Revocare l'accesso a ${email}?`)) return;
    const { error } = await supabase.from("membri_autorizzati").delete().eq("email", email);
    setMsg(error ? "⚠ " + error.message : "✅ Accesso revocato");
    carica();
  };

  const creaLega = async () => {
    const { error } = await supabase.from("leghe").insert({ nome: nomeLega, slug: slugLega.toLowerCase() });
    setMsg(error ? "⚠ " + error.message : "✅ Lega creata");
    setNomeLega(""); setSlugLega("");
    carica();
  };

  if (stato === "verifica") return <div className="centered">Verifica permessi…</div>;
  if (stato === "no-login") return <div className="centered"><a className="plink" href="/">Fai login per continuare</a></div>;
  if (stato === "no-admin") return <div className="centered">Solo l&apos;admin può accedere a questa pagina. <a className="plink" href="/">← Torna alla lega</a></div>;

  const inAttesa = richieste.filter((r) => r.stato === "in_attesa");
  const gestite = richieste.filter((r) => r.stato !== "in_attesa");

  return (
    <div className="wrap">
      <div className="brand">
        <h1>Pannello <em>Admin</em></h1>
        <span className="season"><a className="plink" href="/">← Torna a Scarsi League</a></span>
      </div>
      {msg && <div className="note" style={{ marginTop: 12 }}>{msg}</div>}

      <h2>Richieste in attesa ({inAttesa.length})</h2>
      {inAttesa.length === 0 ? (
        <p className="season">Nessuna richiesta — tutto tranquillo 😌</p>
      ) : (
        <table>
          <thead><tr><th>Email</th><th>Nome</th><th>Messaggio</th><th>Quando</th><th>Azioni</th></tr></thead>
          <tbody>
            {inAttesa.map((r) => (
              <tr key={r.email}>
                <td>{r.email}</td>
                <td className="pname">{r.nome}</td>
                <td>{r.messaggio || "—"}</td>
                <td>{new Date(r.richiesta_il).toLocaleDateString("it-IT")}</td>
                <td>
                  <button className="mini ok" onClick={() => azione("approva_richiesta", r.email)}>✓ Approva</button>{" "}
                  <button className="mini no" onClick={() => azione("rifiuta_richiesta", r.email)}>✗ Rifiuta</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h2>Membri ({membri.length})</h2>
      <table>
        <thead><tr><th>Email</th><th>Nome</th><th>Ruolo</th><th>Scheda</th><th>Dal</th><th></th></tr></thead>
        <tbody>
          {membri.map((m) => (
            <tr key={m.email}>
              <td>{m.email}</td>
              <td className="pname">{m.nome || "—"}</td>
              <td>{m.ruolo === "admin" ? "👑 admin" : "membro"}</td>
              <td>{m.giocatore_id ? `#${m.giocatore_id}` : "—"}</td>
              <td>{new Date(m.aggiunto_il).toLocaleDateString("it-IT")}</td>
              <td>{m.ruolo !== "admin" && (
                <button className="mini no" onClick={() => revoca(m.email)}>Revoca</button>
              )}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {gestite.length > 0 && (
        <>
          <h2>Storico richieste</h2>
          <table>
            <thead><tr><th>Email</th><th>Nome</th><th>Stato</th></tr></thead>
            <tbody>
              {gestite.map((r) => (
                <tr key={r.email}>
                  <td>{r.email}</td><td>{r.nome}</td>
                  <td>{r.stato === "approvata" ? "✅ approvata" : "❌ rifiutata"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      <h2>Leghe ({leghe.length})</h2>
      <table>
        <thead><tr><th>#</th><th>Nome</th><th>Slug</th><th>Struttura</th></tr></thead>
        <tbody>
          {leghe.map((l) => (
            <tr key={l.id}>
              <td className="rank">{l.id}</td><td className="pname">{l.nome}</td>
              <td>{l.slug}</td><td>{l.struttura || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="betaform">
        <h3>Crea nuova lega (beta)</h3>
        <input placeholder="Nome — es. Champions del Giovedì" value={nomeLega} onChange={(e) => setNomeLega(e.target.value)} />
        <input placeholder="Slug — es. champions-giovedi" value={slugLega} onChange={(e) => setSlugLega(e.target.value)} />
        <button className="mini ok" onClick={creaLega} disabled={!nomeLega || !slugLega}>+ Crea lega</button>
      </div>
    </div>
  );
}
