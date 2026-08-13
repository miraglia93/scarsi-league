"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { tradErroreDb } from "../lib/engine";

// sondaggi della lega: il gestore li crea dal pannello admin, qui i membri
// votano (scelta singola, upsert finché il sondaggio resta aperto) e
// vedono i risultati come barre percentuali
export default function Sondaggi({ legaId, mioEmail }) {
  const [sondaggi, setSondaggi] = useState([]);
  const [opzioni, setOpzioni] = useState([]);
  const [voti, setVoti] = useState([]);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(null); // sondaggio_id in corso di voto

  const carica = async () => {
    const { data: s } = await supabase.from("sondaggi").select("*").eq("lega_id", legaId).order("creato_il", { ascending: false });
    setSondaggi(s || []);
    const ids = (s || []).map((x) => x.id);
    if (ids.length) {
      const [{ data: o }, { data: v }] = await Promise.all([
        supabase.from("opzioni_sondaggio").select("*").in("sondaggio_id", ids),
        supabase.from("voti_sondaggio").select("*").in("sondaggio_id", ids),
      ]);
      setOpzioni(o || []);
      setVoti(v || []);
    } else {
      setOpzioni([]); setVoti([]);
    }
  };

  useEffect(() => { carica(); }, [legaId]);

  const vota = async (sondaggioId, opzioneId) => {
    setBusy(sondaggioId); setMsg("");
    const { error } = await supabase.from("voti_sondaggio").upsert(
      { sondaggio_id: sondaggioId, opzione_id: opzioneId, autore_email: mioEmail },
      { onConflict: "sondaggio_id,autore_email" }
    );
    setBusy(null);
    if (error) { setMsg("⚠ " + tradErroreDb(error.message)); return; }
    carica();
  };

  if (sondaggi.length === 0) return <p className="season" style={{ marginTop: 16 }}>Nessun sondaggio ancora.</p>;

  const aperti = sondaggi.filter((s) => s.stato === "aperto");
  const chiusi = sondaggi.filter((s) => s.stato !== "aperto");

  const renderSondaggio = (s) => {
    const opzioniS = opzioni.filter((o) => o.sondaggio_id === s.id);
    const votiS = voti.filter((v) => v.sondaggio_id === s.id);
    const mioVoto = votiS.find((v) => v.autore_email === mioEmail);
    const totale = votiS.length;
    const mostraRisultati = s.stato === "chiuso" || !!mioVoto;

    return (
      <div key={s.id} className="formrow" style={{ alignItems: "flex-start", flexDirection: "column", gap: 10 }}>
        <div className="forminfo">
          <span className="formname">{s.domanda}</span>
          <span className="formruolo">{s.stato === "chiuso" ? "chiuso" : "aperto"} · {totale} vot{totale === 1 ? "o" : "i"}</span>
        </div>
        <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 8 }}>
          {opzioniS.map((o) => {
            const n = votiS.filter((v) => v.opzione_id === o.id).length;
            const pct = totale ? Math.round((n / totale) * 100) : 0;
            const scelta = mioVoto?.opzione_id === o.id;
            if (mostraRisultati) {
              return (
                <div key={o.id}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                    <span>{scelta ? "✓ " : ""}{o.testo}</span>
                    <span>{pct}% ({n})</span>
                  </div>
                  <div style={{ background: "rgba(232,237,230,.1)", borderRadius: 4, height: 8, marginTop: 4 }}>
                    <div style={{ background: scelta ? "var(--oro, #E3C567)" : "rgba(232,237,230,.35)", width: `${pct}%`, height: "100%", borderRadius: 4 }} />
                  </div>
                </div>
              );
            }
            return (
              <button key={o.id} type="button" className="mini" disabled={busy === s.id}
                onClick={() => vota(s.id, o.id)} style={{ textAlign: "left" }}>
                {o.testo}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div style={{ marginTop: 16 }}>
      {msg && <div className="note">{msg}</div>}
      {aperti.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {aperti.map(renderSondaggio)}
        </div>
      )}
      {chiusi.length > 0 && (
        <>
          <h3 style={{ marginTop: aperti.length ? 24 : 0 }}>Chiusi</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {chiusi.map(renderSondaggio)}
          </div>
        </>
      )}
    </div>
  );
}
