"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { tradErroreDb } from "../lib/engine";

// pannello per il capitano di UNA squadra in questa partita: stesso
// insieme di campi di "Dati partita" in PannelloGestioneLega.jsx, ma
// filtrato ai soli giocatori della propria squadra e scrivibile grazie
// alla policy RLS "capitano modifica propria squadra" su dati_manuali
export default function CapitanoSquadra({ partitaId, squadra, giocatori }) {
  const [righe, setRighe] = useState([]);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const carica = async () => {
    const [{ data: pr }, { data: dm }] = await Promise.all([
      supabase.from("prestazioni").select("giocatore_id, ruolo").eq("partita_id", partitaId).eq("squadra", squadra),
      supabase.from("dati_manuali").select("*").eq("partita_id", partitaId),
    ]);
    const dmMap = {};
    (dm || []).forEach((d) => { dmMap[d.giocatore_id] = d; });
    const nuoveRighe = (pr || []).map((p) => {
      const g = giocatori[p.giocatore_id];
      const esistente = dmMap[p.giocatore_id];
      return {
        giocatore_id: p.giocatore_id,
        nome: g?.nickname || g?.nome || "Giocatore",
        ruolo: p.ruolo || g?.ruolo_prevalente || "—",
        gol_manuale: esistente?.gol_manuale ?? "",
        assist: esistente?.assist ?? 0,
        clean_sheet: esistente?.clean_sheet ?? false,
        gol_subiti: esistente?.gol_subiti ?? "",
        cartellini: esistente?.cartellini ?? 0,
        autogol: esistente?.autogol ?? 0,
      };
    }).sort((a, b) => a.nome.localeCompare(b.nome));
    setRighe(nuoveRighe);
  };

  useEffect(() => { carica(); }, [partitaId, squadra]);

  const aggiorna = (giocatoreId, campo, valore) => {
    setRighe((r) => r.map((x) => (x.giocatore_id === giocatoreId ? { ...x, [campo]: valore } : x)));
  };

  const salva = async () => {
    setBusy(true); setMsg("");
    const payload = righe.map((r) => ({
      partita_id: partitaId,
      giocatore_id: r.giocatore_id,
      gol_manuale: r.gol_manuale === "" ? null : Number(r.gol_manuale),
      assist: Number(r.assist) || 0,
      clean_sheet: !!r.clean_sheet,
      gol_subiti: r.gol_subiti === "" ? null : Number(r.gol_subiti),
      cartellini: Number(r.cartellini) || 0,
      autogol: Number(r.autogol) || 0,
    }));
    const { error } = await supabase.from("dati_manuali").upsert(payload, { onConflict: "partita_id,giocatore_id" });
    setBusy(false);
    setMsg(error ? "⚠ " + tradErroreDb(error.message) : "✅ Dati salvati");
    carica();
  };

  if (righe.length === 0) return null;

  return (
    <div style={{ marginTop: 16 }}>
      <h3>{squadra}</h3>
      <div style={{ overflowX: "auto" }}>
        <table>
          <thead><tr>
            <th>Giocatore</th><th>Ruolo</th><th className="num">Gol</th><th className="num">Assist</th>
            <th className="num">Clean sheet</th><th className="num">Gol subiti</th>
            <th className="num">Cartellini</th><th className="num">Autogol</th>
          </tr></thead>
          <tbody>
            {righe.map((r) => (
              <tr key={r.giocatore_id}>
                <td className="pname">{r.nome}</td>
                <td>{r.ruolo}</td>
                <td className="num">
                  <input type="number" min="0" style={{ width: 56 }} value={r.gol_manuale} placeholder="Fubles"
                    onChange={(e) => aggiorna(r.giocatore_id, "gol_manuale", e.target.value)} />
                </td>
                <td className="num">
                  <input type="number" min="0" value={r.assist}
                    onChange={(e) => aggiorna(r.giocatore_id, "assist", e.target.value)} />
                </td>
                <td className="num">
                  <input type="checkbox" checked={r.clean_sheet}
                    onChange={(e) => aggiorna(r.giocatore_id, "clean_sheet", e.target.checked)} />
                </td>
                <td className="num">
                  {r.ruolo === "POR"
                    ? <input type="number" min="0" value={r.gol_subiti}
                        onChange={(e) => aggiorna(r.giocatore_id, "gol_subiti", e.target.value)} />
                    : "—"}
                </td>
                <td className="num">
                  <input type="number" min="0" value={r.cartellini}
                    onChange={(e) => aggiorna(r.giocatore_id, "cartellini", e.target.value)} />
                </td>
                <td className="num">
                  <input type="number" min="0" value={r.autogol}
                    onChange={(e) => aggiorna(r.giocatore_id, "autogol", e.target.value)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button className="mini ok" style={{ marginTop: 10 }} onClick={salva} disabled={busy}>
        {busy ? "Salvataggio…" : "💾 Salva"}
      </button>
      {msg && <div className="note">{msg}</div>}
    </div>
  );
}
