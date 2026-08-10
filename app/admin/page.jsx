"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { tradErroreDb } from "../../lib/engine";
import AppNav from "../../components/AppNav";
import SubTabs from "../../components/SubTabs";
import PannelloGestioneLega from "../../components/PannelloGestioneLega";

// pagina standalone, tenuta per i bookmark e per chi amministra più
// leghe: qui puoi scegliere quale gestire (lo switcher globale in alto
// sceglie solo la lega "attiva" per la navigazione, non per l'admin).
// La gestione vera e propria è la stessa scheda montata dentro la
// sezione Lega — PannelloGestioneLega, condiviso tra le due pagine.
export default function Admin() {
  const [stato, setStato] = useState("verifica"); // verifica | no-login | no-admin | ok
  const [sezione, setSezione] = useState("gestione"); // gestione | piattaforma
  const [mieGestioni, setMieGestioni] = useState([]); // [{ ruolo, lega_id }] dove sono admin o coorganizzatore
  const [adminLegaId, setAdminLegaId] = useState(null);
  const [leghe, setLeghe] = useState([]);
  const [superAdmin, setSuperAdmin] = useState(false);
  const [utentiPiattaforma, setUtentiPiattaforma] = useState([]);
  const [msg, setMsg] = useState("");

  const ruoloUtente = mieGestioni.find((m) => m.lega_id === adminLegaId)?.ruolo || "membro";

  const caricaPiattaforma = async () => {
    const { data } = await supabase.from("utenti_piattaforma").select("*").order("creato_il");
    setUtentiPiattaforma(data || []);
  };

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setStato("no-login"); return; }
      const mail = (session.user?.email || "").toLowerCase();
      const { data: mie } = await supabase.from("membri_autorizzati")
        .select("ruolo, lega_id").eq("email", mail);
      const gestioni = (mie || []).filter((m) => m.ruolo === "admin" || m.ruolo === "coorganizzatore");
      if (!gestioni.length) { setStato("no-admin"); return; }
      setMieGestioni(gestioni);
      const ids = gestioni.map((g) => g.lega_id);
      setAdminLegaId(ids[0]);
      const { data: le } = await supabase.from("leghe").select("id, nome").in("id", ids);
      setLeghe(le || []);
      const { data: isSuper } = await supabase.rpc("is_super_admin");
      setSuperAdmin(!!isSuper);
      if (isSuper) caricaPiattaforma();
      setStato("ok");
    })();
  }, []);

  const toggleAbbonamento = async (email, attivo) => {
    const { error } = await supabase.from("utenti_piattaforma").update({ abbonamento_attivo: attivo }).eq("email", email);
    setMsg(error ? "⚠ " + tradErroreDb(error.message) : "✅ Abbonamento aggiornato");
    caricaPiattaforma();
  };

  if (stato === "verifica") return <div className="centered">Verifica permessi…</div>;
  if (stato === "no-login") return <div className="centered"><a className="plink" href="/">Fai login per continuare</a></div>;
  if (stato === "no-admin") return <div className="centered">Solo admin e coorganizzatori possono accedere a questa pagina. <a className="plink" href="/">← Torna alla lega</a></div>;

  return (
    <>
      <AppNav active="tu" />
      <div className="wrap navpad">
        <div className="brand">
          <h1>Pannello <em>Admin</em></h1>
          <span className="season"><a className="plink" href="/?sezione=tu">← Torna alla bacheca</a></span>
        </div>
        {mieGestioni.length > 1 && (
          <select className="legasel" value={adminLegaId ?? ""} onChange={(e) => setAdminLegaId(Number(e.target.value))}>
            {leghe.map((l) => (
              <option key={l.id} value={l.id}>Gestisci: {l.nome}</option>
            ))}
          </select>
        )}
        {msg && <div className="note" style={{ marginTop: 12 }}>{msg}</div>}

        {superAdmin && (
          <SubTabs active={sezione} onSelect={setSezione} tabs={[
            { key: "gestione", label: "Gestione lega" },
            { key: "piattaforma", label: "Piattaforma" },
          ]} />
        )}

        {sezione === "gestione" && adminLegaId != null && (
          <PannelloGestioneLega legaId={adminLegaId} ruoloUtente={ruoloUtente} />
        )}

        {sezione === "piattaforma" && superAdmin && (
          <>
            <h2>Piattaforma — abbonamenti ({utentiPiattaforma.length})</h2>
            {utentiPiattaforma.length === 0 ? (
              <p className="season">Nessuna richiesta di abbonamento ancora.</p>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table>
                  <thead><tr><th>Email</th><th>Piano</th><th>Abbonamento</th><th>Dal</th><th></th></tr></thead>
                  <tbody>
                    {utentiPiattaforma.map((u) => (
                      <tr key={u.email}>
                        <td>{u.email}</td>
                        <td>{u.piano}{u.super_admin ? " · super admin" : ""}</td>
                        <td>{u.abbonamento_attivo ? "🟢 attivo" : "⚪ non attivo"}</td>
                        <td>{new Date(u.creato_il).toLocaleDateString("it-IT")}</td>
                        <td>
                          {u.abbonamento_attivo
                            ? <button className="mini no" onClick={() => toggleAbbonamento(u.email, false)}>Disattiva</button>
                            : <button className="mini ok" onClick={() => toggleAbbonamento(u.email, true)}>Attiva</button>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
