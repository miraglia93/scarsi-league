"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { tradErroreDb } from "../lib/engine";

// il capitano vota i giocatori della squadra AVVERSARIA (mai i propri
// compagni, per imparzialità): giudizio diretto, salvato subito, niente
// approvazione — a differenza delle correzioni gol/assist in
// ProposteIncrociate. Ha effetto sulla media/overall/MVP solo se la
// stagione di questa partita ha un "peso voto capitano" impostato
// (applicaVotoArricchito in lib/engine.js).
export default function VotiCapitano({ partitaId, mieSquadre, tutteLeSquadre, giocatori, mioEmail }) {
  const [righePerSquadra, setRighePerSquadra] = useState({});
  const [msg, setMsg] = useState("");
  const [busyId, setBusyId] = useState(null);

  const squadreAltrui = tutteLeSquadre.filter((s) => !mieSquadre.includes(s));

  const carica = async () => {
    if (!squadreAltrui.length) { setRighePerSquadra({}); return; }
    const [{ data: pr }, { data: vc }] = await Promise.all([
      supabase.from("prestazioni").select("giocatore_id, ruolo, squadra").eq("partita_id", partitaId).in("squadra", squadreAltrui),
      supabase.from("voti_capitano").select("*").eq("partita_id", partitaId),
    ]);
    const votoByGiocatore = {};
    (vc || []).forEach((v) => { votoByGiocatore[v.giocatore_id] = v.voto; });
    const perSquadra = {};
    squadreAltrui.forEach((s) => { perSquadra[s] = []; });
    (pr || []).forEach((p) => {
      const g = giocatori[p.giocatore_id];
      (perSquadra[p.squadra] ||= []).push({
        giocatore_id: p.giocatore_id,
        nome: g?.nickname || g?.nome || "Giocatore",
        ruolo: p.ruolo || g?.ruolo_prevalente || "—",
        voto: votoByGiocatore[p.giocatore_id] ?? "",
      });
    });
    Object.values(perSquadra).forEach((arr) => arr.sort((a, b) => a.nome.localeCompare(b.nome)));
    setRighePerSquadra(perSquadra);
  };

  useEffect(() => { carica(); }, [partitaId, mieSquadre.join(","), tutteLeSquadre.join(",")]);

  const aggiorna = (squadra, giocatoreId, valore) => {
    setRighePerSquadra((prev) => ({
      ...prev,
      [squadra]: prev[squadra].map((r) => (r.giocatore_id === giocatoreId ? { ...r, voto: valore } : r)),
    }));
  };

  const salvaVoto = async (riga) => {
    if (riga.voto === "") return;
    setBusyId(riga.giocatore_id); setMsg("");
    const { error } = await supabase.from("voti_capitano")
      .upsert({ partita_id: partitaId, giocatore_id: riga.giocatore_id, voto: Number(riga.voto), capitano_email: mioEmail }, { onConflict: "partita_id,giocatore_id" });
    setBusyId(null);
    setMsg(error ? "⚠ " + tradErroreDb(error.message) : "✅ Voto salvato");
  };

  if (!squadreAltrui.length) return null;

  return (
    <div style={{ marginTop: 24 }}>
      {squadreAltrui.map((squadra) => {
        const righe = righePerSquadra[squadra] || [];
        if (!righe.length) return null;
        return (
          <div key={squadra} style={{ marginTop: 16 }}>
            <h3>Vota {squadra}</h3>
            <p className="season">Giudizio diretto sui giocatori avversari — salvato subito, nessuna approvazione.</p>
            <div style={{ overflowX: "auto" }}>
              <table>
                <thead><tr><th>Giocatore</th><th>Ruolo</th><th className="num">Voto</th><th></th></tr></thead>
                <tbody>
                  {righe.map((r) => (
                    <tr key={r.giocatore_id}>
                      <td className="pname">{r.nome}</td>
                      <td>{r.ruolo}</td>
                      <td className="num">
                        <input type="number" min="1" max="10" step="0.5" style={{ width: 56 }}
                          value={r.voto} onChange={(e) => aggiorna(squadra, r.giocatore_id, e.target.value)} />
                      </td>
                      <td>
                        <button className="mini ok" disabled={busyId === r.giocatore_id || r.voto === ""}
                          onClick={() => salvaVoto(r)}>💾</button>
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
