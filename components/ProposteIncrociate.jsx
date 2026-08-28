"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { tradErroreDb } from "../lib/engine";

function rigaVuota(p) {
  return {
    giocatore_id: p.giocatore_id,
    nome: p.nome,
    ruolo: p.ruolo,
    gol_manuale: "",
    assist: 0,
    clean_sheet: false,
    gol_subiti: "",
    cartellini: 0,
    autogol: 0,
  };
}

// per il capitano di UNA squadra: propone correzioni per i giocatori
// dell'ALTRA squadra (soggette ad approvazione del capitano bersaglio
// o del gestore) e approva/rifiuta le proposte ricevute sulla propria
export default function ProposteIncrociate({ partitaId, mioEmail, mieSquadre, tutteLeSquadre, giocatori }) {
  const [righePerSquadra, setRighePerSquadra] = useState({});
  const [proposte, setProposte] = useState([]);
  const [msg, setMsg] = useState("");
  const [busyId, setBusyId] = useState(null);

  const squadreAltrui = tutteLeSquadre.filter((s) => !mieSquadre.includes(s));

  const carica = async () => {
    const [{ data: pr }, { data: prop }] = await Promise.all([
      squadreAltrui.length
        ? supabase.from("prestazioni").select("giocatore_id, ruolo, squadra").eq("partita_id", partitaId).in("squadra", squadreAltrui)
        : Promise.resolve({ data: [] }),
      supabase.from("dati_manuali_proposte").select("*").eq("partita_id", partitaId).order("creato_il", { ascending: false }),
    ]);
    const perSquadra = {};
    squadreAltrui.forEach((s) => { perSquadra[s] = []; });
    (pr || []).forEach((p) => {
      const g = giocatori[p.giocatore_id];
      (perSquadra[p.squadra] ||= []).push(rigaVuota({
        giocatore_id: p.giocatore_id,
        ruolo: p.ruolo || g?.ruolo_prevalente || "—",
        nome: g?.nickname || g?.nome || "Giocatore",
      }));
    });
    Object.values(perSquadra).forEach((arr) => arr.sort((a, b) => a.nome.localeCompare(b.nome)));
    setRighePerSquadra(perSquadra);
    setProposte(prop || []);
  };

  useEffect(() => { carica(); }, [partitaId, mieSquadre.join(","), tutteLeSquadre.join(",")]);

  const aggiorna = (squadra, giocatoreId, campo, valore) => {
    setRighePerSquadra((prev) => ({
      ...prev,
      [squadra]: prev[squadra].map((r) => (r.giocatore_id === giocatoreId ? { ...r, [campo]: valore } : r)),
    }));
  };

  const inviaProposta = async (riga) => {
    setMsg("");
    const payload = {
      partita_id: partitaId,
      giocatore_id: riga.giocatore_id,
      proposto_da_email: mioEmail,
      gol_manuale: riga.gol_manuale === "" ? null : Number(riga.gol_manuale),
      assist: Number(riga.assist) || 0,
      clean_sheet: !!riga.clean_sheet,
      gol_subiti: riga.gol_subiti === "" ? null : Number(riga.gol_subiti),
      cartellini: Number(riga.cartellini) || 0,
      autogol: Number(riga.autogol) || 0,
    };
    const { error } = await supabase.from("dati_manuali_proposte").insert(payload);
    setMsg(error ? "⚠ " + tradErroreDb(error.message) : "✅ Proposta inviata, in attesa di approvazione");
    carica();
  };

  const decidi = async (fn, id) => {
    setBusyId(id); setMsg("");
    const { data, error } = await supabase.rpc(fn, { p_id: id });
    setBusyId(null);
    setMsg(error || data !== "ok" ? "⚠ " + (error ? tradErroreDb(error.message) : data) : "✅ Fatto");
    carica();
  };

  const nomeGiocatore = (id) => giocatori[id]?.nickname || giocatori[id]?.nome || `#${id}`;
  const inAttesaPerTe = proposte.filter((p) => p.stato === "in_attesa" && p.proposto_da_email !== mioEmail);
  const tueInviate = proposte.filter((p) => p.proposto_da_email === mioEmail);
  const giaProposti = new Set(proposte.filter((p) => p.proposto_da_email === mioEmail && p.stato === "in_attesa").map((p) => p.giocatore_id));

  return (
    <div style={{ marginTop: 24 }}>
      {inAttesaPerTe.length > 0 && (
        <>
          <h3>Proposte da approvare</h3>
          <div style={{ overflowX: "auto" }}>
            <table>
              <thead><tr><th>Giocatore</th><th>Da</th><th className="num">Gol</th><th className="num">Assist</th><th className="num">Cartellini</th><th>Azioni</th></tr></thead>
              <tbody>
                {inAttesaPerTe.map((p) => (
                  <tr key={p.id}>
                    <td className="pname">{nomeGiocatore(p.giocatore_id)}</td>
                    <td>{p.proposto_da_email}</td>
                    <td className="num">{p.gol_manuale ?? "—"}</td>
                    <td className="num">{p.assist}</td>
                    <td className="num">{p.cartellini}</td>
                    <td>
                      <button className="mini ok" disabled={busyId === p.id} onClick={() => decidi("approva_proposta_dati", p.id)}>✓ Approva</button>{" "}
                      <button className="mini no" disabled={busyId === p.id} onClick={() => decidi("rifiuta_proposta_dati", p.id)}>✗ Rifiuta</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {squadreAltrui.map((squadra) => {
        const righe = righePerSquadra[squadra] || [];
        const daProporre = righe.filter((r) => !giaProposti.has(r.giocatore_id));
        if (righe.length === 0) return null;
        return (
          <div key={squadra} style={{ marginTop: 16 }}>
            <h3>Proponi per {squadra}</h3>
            {daProporre.length === 0 ? (
              <p className="note">Hai già una proposta in attesa per tutti questi giocatori.</p>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table>
                  <thead><tr>
                    <th>Giocatore</th><th>Ruolo</th><th className="num">Gol</th><th className="num">Assist</th>
                    <th className="num">Clean sheet</th><th className="num">Gol subiti</th>
                    <th className="num">Cartellini</th><th className="num">Autogol</th><th></th>
                  </tr></thead>
                  <tbody>
                    {daProporre.map((r) => (
                      <tr key={r.giocatore_id}>
                        <td className="pname">{r.nome}</td>
                        <td>{r.ruolo}</td>
                        <td className="num">
                          <input type="number" min="0" style={{ width: 56 }} value={r.gol_manuale} placeholder="Fubles"
                            onChange={(e) => aggiorna(squadra, r.giocatore_id, "gol_manuale", e.target.value)} />
                        </td>
                        <td className="num">
                          <input type="number" min="0" value={r.assist}
                            onChange={(e) => aggiorna(squadra, r.giocatore_id, "assist", e.target.value)} />
                        </td>
                        <td className="num">
                          <input type="checkbox" checked={r.clean_sheet}
                            onChange={(e) => aggiorna(squadra, r.giocatore_id, "clean_sheet", e.target.checked)} />
                        </td>
                        <td className="num">
                          {r.ruolo === "POR"
                            ? <input type="number" min="0" value={r.gol_subiti}
                                onChange={(e) => aggiorna(squadra, r.giocatore_id, "gol_subiti", e.target.value)} />
                            : "—"}
                        </td>
                        <td className="num">
                          <input type="number" min="0" value={r.cartellini}
                            onChange={(e) => aggiorna(squadra, r.giocatore_id, "cartellini", e.target.value)} />
                        </td>
                        <td className="num">
                          <input type="number" min="0" value={r.autogol}
                            onChange={(e) => aggiorna(squadra, r.giocatore_id, "autogol", e.target.value)} />
                        </td>
                        <td>
                          <button className="mini ok" onClick={() => inviaProposta(r)}>Proponi</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}

      {tueInviate.length > 0 && (
        <>
          <h3>Le tue proposte inviate</h3>
          <div style={{ overflowX: "auto" }}>
            <table>
              <thead><tr><th>Giocatore</th><th className="num">Gol</th><th>Stato</th></tr></thead>
              <tbody>
                {tueInviate.map((p) => (
                  <tr key={p.id}>
                    <td className="pname">{nomeGiocatore(p.giocatore_id)}</td>
                    <td className="num">{p.gol_manuale ?? "—"}</td>
                    <td>{p.stato === "in_attesa" ? "⏳ in attesa" : p.stato === "approvata" ? "✅ approvata" : "❌ rifiutata"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {msg && <div className="note">{msg}</div>}
    </div>
  );
}
