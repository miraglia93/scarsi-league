"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { tradErroreDb, iniziali } from "../lib/engine";

const REAZIONI = [
  { emoji: "😂", label: "Vergognati" },
  { emoji: "🔥", label: "Bestia" },
  { emoji: "😭", label: "Scarso Certificato" },
  { emoji: "🤡", label: "Pagliaccio" },
  { emoji: "👏", label: "Rispetto" },
  { emoji: "💪", label: "Duro" },
];

const fmtQuando = (iso) => new Date(iso).toLocaleString("it-IT", {
  day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
});

// commenti + reazioni emoji su una partita: prima funzionalità in cui
// un membro qualsiasi scrive contenuto pubblico, non solo l'admin
export default function CommentiPartita({ partitaId, legaId, mioEmail, sonoGestore }) {
  const [commenti, setCommenti] = useState([]);
  const [reazioni, setReazioni] = useState([]);
  const [display, setDisplay] = useState({}); // email -> { nome_visualizzato, foto_url }
  const [testo, setTesto] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const carica = async () => {
    const [{ data: c }, { data: d }] = await Promise.all([
      supabase.from("commenti_partita").select("*").eq("partita_id", partitaId).order("creato_il", { ascending: false }),
      supabase.rpc("membri_display", { p_lega_id: legaId }),
    ]);
    setCommenti(c || []);
    const mappa = {};
    (d || []).forEach((r) => { mappa[r.email] = r; });
    setDisplay(mappa);
    const ids = (c || []).map((x) => x.id);
    if (ids.length) {
      const { data: r } = await supabase.from("reazioni_commento").select("*").in("commento_id", ids);
      setReazioni(r || []);
    } else {
      setReazioni([]);
    }
  };

  useEffect(() => { carica(); }, [partitaId, legaId]);

  const invia = async () => {
    if (!testo.trim()) return;
    setBusy(true); setMsg("");
    const { error } = await supabase.from("commenti_partita").insert({
      partita_id: partitaId, autore_email: mioEmail, testo: testo.trim(),
    });
    setBusy(false);
    if (error) { setMsg("⚠ " + tradErroreDb(error.message)); return; }
    setTesto("");
    carica();
  };

  const elimina = async (id) => {
    if (!confirm("Eliminare questo commento?")) return;
    const { error } = await supabase.from("commenti_partita").delete().eq("id", id);
    setMsg(error ? "⚠ " + tradErroreDb(error.message) : "");
    carica();
  };

  const reagisci = async (commentoId, emoji) => {
    const mia = reazioni.find((r) => r.commento_id === commentoId && r.autore_email === mioEmail);
    if (mia && mia.emoji === emoji) {
      await supabase.from("reazioni_commento").delete().eq("id", mia.id);
    } else {
      await supabase.from("reazioni_commento").upsert(
        { commento_id: commentoId, autore_email: mioEmail, emoji },
        { onConflict: "commento_id,autore_email" }
      );
    }
    carica();
  };

  const nomeDi = (email) => display[email]?.nome_visualizzato || email.split("@")[0];
  const fotoDi = (email) => display[email]?.foto_url;

  return (
    <div style={{ marginTop: 16 }}>
      <div className="betaform">
        <textarea placeholder="Scrivi un commento…" value={testo} maxLength={500}
          onChange={(e) => setTesto(e.target.value)} rows={3}
          style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid rgba(232,237,230,.25)",
            background: "#0B1210", color: "#E8EDE6", fontFamily: "'Archivo'", fontSize: 14, resize: "vertical" }} />
        <button className="mini ok" style={{ marginTop: 10 }} disabled={busy || !testo.trim()} onClick={invia}>
          {busy ? "Invio…" : "Commenta"}
        </button>
        {msg && <div className="note">{msg}</div>}
      </div>

      {commenti.length === 0 ? (
        <p className="season" style={{ marginTop: 16 }}>Nessun commento ancora — rompi il ghiaccio.</p>
      ) : (
        <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 14 }}>
          {commenti.map((c) => {
            const mieReazioni = reazioni.filter((r) => r.commento_id === c.id);
            const conteggi = {};
            mieReazioni.forEach((r) => { conteggi[r.emoji] = (conteggi[r.emoji] || 0) + 1; });
            const miaReazione = mieReazioni.find((r) => r.autore_email === mioEmail)?.emoji;
            const foto = fotoDi(c.autore_email);
            return (
              <div key={c.id} className="formrow" style={{ alignItems: "flex-start" }}>
                {foto
                  ? <img className="formfoto" src={foto} alt={nomeDi(c.autore_email)} />
                  : <div className="formavatar">{iniziali(nomeDi(c.autore_email))}</div>}
                <div className="forminfo" style={{ flex: 1 }}>
                  <span className="formname">{nomeDi(c.autore_email)}</span>
                  <span className="formruolo">{fmtQuando(c.creato_il)}</span>
                  <p style={{ margin: "6px 0", color: "var(--chalk, #E8EDE6)" }}>{c.testo}</p>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                    {REAZIONI.map(({ emoji, label }) => (
                      <button key={emoji} type="button" title={label}
                        className={miaReazione === emoji ? "mini ok" : "mini"}
                        onClick={() => reagisci(c.id, emoji)}>
                        {emoji}{conteggi[emoji] ? ` ${conteggi[emoji]}` : ""}
                      </button>
                    ))}
                    {(c.autore_email === mioEmail || sonoGestore) && (
                      <button className="mini no" onClick={() => elimina(c.id)}>Elimina</button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
