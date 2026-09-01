"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { tradErroreDb } from "../lib/engine";

const CAMPI = ["gol_manuale", "assist", "cartellini", "autogol"];
const ETICHETTE = { gol_manuale: "Gol", assist: "Assist", cartellini: "Cartellini", autogol: "Autogol" };

// il cronista segna eventi per ENTRAMBE le squadre durante la diretta —
// a differenza del capitano (una squadra sola). Ogni tap scrive subito
// su dati_manuali, la stessa tabella mai toccata dal re-import Fubles:
// il dato live resta quello "vero" anche dopo l'import post-partita.
export default function LiveCronista({ partitaId, squadre, giocatori, onChange }) {
  const [righe, setRighe] = useState([]);
  const [msg, setMsg] = useState("");
  const [busyChiave, setBusyChiave] = useState(null);

  const carica = async () => {
    const [{ data: pr }, { data: dm }] = await Promise.all([
      supabase.from("prestazioni").select("giocatore_id, ruolo, squadra").eq("partita_id", partitaId),
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
        squadra: p.squadra,
        gol_manuale: esistente?.gol_manuale || 0,
        assist: esistente?.assist || 0,
        clean_sheet: !!esistente?.clean_sheet,
        gol_subiti: esistente?.gol_subiti || 0,
        cartellini: esistente?.cartellini || 0,
        autogol: esistente?.autogol || 0,
      };
    }).sort((a, b) => a.squadra.localeCompare(b.squadra) || a.nome.localeCompare(b.nome));
    setRighe(nuoveRighe);
  };

  useEffect(() => { carica(); }, [partitaId]);

  const salvaCampo = async (riga, campo, valore) => {
    const chiave = `${riga.giocatore_id}_${campo}`;
    setBusyChiave(chiave); setMsg("");
    setRighe((rs) => rs.map((r) => (r.giocatore_id === riga.giocatore_id ? { ...r, [campo]: valore } : r)));
    const { error } = await supabase.from("dati_manuali")
      .upsert({ partita_id: partitaId, giocatore_id: riga.giocatore_id, [campo]: valore }, { onConflict: "partita_id,giocatore_id" });
    setBusyChiave(null);
    if (error) { setMsg("⚠ " + tradErroreDb(error.message)); carica(); }
    else onChange?.();
  };

  const incrementa = (riga, campo, delta) => {
    const nuovo = Math.max(0, (riga[campo] || 0) + delta);
    salvaCampo(riga, campo, nuovo);
  };

  if (!righe.length) return null;

  return (
    <div style={{ marginTop: 16 }}>
      {squadre.map((squadra) => {
        const righeSquadra = righe.filter((r) => r.squadra === squadra);
        if (!righeSquadra.length) return null;
        return (
          <div key={squadra} style={{ marginTop: 16 }}>
            <h3>{squadra}</h3>
            <div style={{ overflowX: "auto" }}>
              <table>
                <thead><tr>
                  <th>Giocatore</th>
                  {CAMPI.map((c) => <th key={c} className="num">{ETICHETTE[c]}</th>)}
                  <th className="num">Clean sheet</th><th className="num">Gol subiti</th>
                </tr></thead>
                <tbody>
                  {righeSquadra.map((r) => (
                    <tr key={r.giocatore_id}>
                      <td className="pname">{r.nome}</td>
                      {CAMPI.map((campo) => (
                        <td key={campo} className="num">
                          <div style={{ display: "flex", alignItems: "center", gap: 4, justifyContent: "center" }}>
                            <button type="button" className="mini" disabled={busyChiave === `${r.giocatore_id}_${campo}`}
                              onClick={() => incrementa(r, campo, -1)}>−</button>
                            <span style={{ minWidth: 18, textAlign: "center" }}>{r[campo]}</span>
                            <button type="button" className="mini ok" disabled={busyChiave === `${r.giocatore_id}_${campo}`}
                              onClick={() => incrementa(r, campo, 1)}>+</button>
                          </div>
                        </td>
                      ))}
                      <td className="num">
                        <input type="checkbox" checked={r.clean_sheet}
                          onChange={(e) => salvaCampo(r, "clean_sheet", e.target.checked)} />
                      </td>
                      <td className="num">
                        {r.ruolo === "POR" ? (
                          <div style={{ display: "flex", alignItems: "center", gap: 4, justifyContent: "center" }}>
                            <button type="button" className="mini" onClick={() => incrementa(r, "gol_subiti", -1)}>−</button>
                            <span style={{ minWidth: 18, textAlign: "center" }}>{r.gol_subiti}</span>
                            <button type="button" className="mini ok" onClick={() => incrementa(r, "gol_subiti", 1)}>+</button>
                          </div>
                        ) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
      {msg && <div className="note">{msg}</div>}
    </div>
  );
}
