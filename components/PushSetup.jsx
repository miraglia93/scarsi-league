"use client";

import { useEffect, useState } from "react";
import { pushSupportato, statoPush, attivaPush, disattivaPush } from "../lib/push";

export default function PushSetup({ email }) {
  const [stato, setStato] = useState("verifica"); // verifica | non-supportato | negato | spento | attivo
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const aggiorna = () => { statoPush().then(setStato); };
  useEffect(() => { if (pushSupportato()) aggiorna(); else setStato("non-supportato"); }, []);

  const attiva = async () => {
    setBusy(true); setMsg("");
    try { await attivaPush(email); aggiorna(); }
    catch (e) { setMsg("⚠ " + e.message); }
    setBusy(false);
  };

  const disattiva = async () => {
    setBusy(true); setMsg("");
    await disattivaPush();
    aggiorna();
    setBusy(false);
  };

  if (stato === "verifica" || stato === "non-supportato") return null;

  return (
    <>
      <h2 style={{ marginTop: 32 }}>Notifiche push</h2>
      <p className="season">
        Ricevi un avviso su questo device quando c&apos;è una nuova partita, un premio, o (se gestisci
        la lega) una richiesta di accesso.
      </p>
      {stato === "negato" && (
        <p className="season">Le notifiche sono bloccate nelle impostazioni del browser — vanno riattivate da lì.</p>
      )}
      {stato === "spento" && (
        <button className="mini ok" onClick={attiva} disabled={busy}>{busy ? "Attivazione…" : "🔔 Attiva notifiche"}</button>
      )}
      {stato === "attivo" && (
        <button className="mini no" onClick={disattiva} disabled={busy}>{busy ? "…" : "🔕 Disattiva su questo device"}</button>
      )}
      {msg && <div className="note">{msg}</div>}
    </>
  );
}
