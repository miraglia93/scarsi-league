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
  const [votiCompagni, setVotiCompagni] = useState([]);
  const [msg, setMsg] = useState("");
  const [busyId, setBusyId] = useState(null);

  const squadreAltrui = tutteLeSquadre.filter((s) => !mieSquadre.includes(s));

  const carica = async () => {
    const [{ data: vc }, { data: prAltrui }, { data: prPropria }] = await Promise.all([
      supabase.from("voti_capitano").select("*").eq("partita_id", partitaId),
      squadreAltrui.length
        ? supabase.from("prestazioni").select("giocatore_id, ruolo, squadra").eq("partita_id", partitaId).in("squadra", squadreAltrui)
        : Promise.resolve({ data: [] }),
      mieSquadre.length
        ? supabase.from("prestazioni").select("giocatore_id").eq("partita_id", partitaId).in("squadra", mieSquadre)
        : Promise.resolve({ data: [] }),
    ]);

    const votoByGiocatore = {};
    (vc || []).forEach((v) => { votoByGiocatore[v.giocatore_id] = v.voto; });
    const perSquadra = {};
    squadreAltrui.forEach((s) => { perSquadra[s] = []; });
    (prAltrui || []).forEach((p) => {
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

    const idsPropria = (prPropria || []).map((p) => p.giocatore_id);
    const { data: vr } = idsPropria.length
      ? await supabase.from("voti_ricevuti").select("*").eq("partita_id", partitaId).in("votante_id", idsPropria)
      : { data: [] };
    setVotiCompagni(vr || []);
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

  const escludiVoto = async (id) => {
    setBusyId(`v${id}`); setMsg("");
    const { error } = await supabase.from("voti_ricevuti").update({ anomalo: true }).eq("id", id);
    setBusyId(null);
    setMsg(error ? "⚠ " + tradErroreDb(error.message) : "✅ Voto escluso");
    carica();
  };

  const ripristinaVoto = async (id) => {
    setBusyId(`v${id}`); setMsg("");
    const { error } = await supabase.from("voti_ricevuti").update({ anomalo: false }).eq("id", id);
    setBusyId(null);
    setMsg(error ? "⚠ " + tradErroreDb(error.message) : "✅ Voto ripristinato");
    carica();
  };

  const escludiTuttiDiVotante = async (votanteId) => {
    setBusyId(`t${votanteId}`); setMsg("");
    const { error } = await supabase.from("voti_ricevuti").update({ anomalo: true })
      .eq("partita_id", partitaId).eq("votante_id", votanteId);
    setBusyId(null);
    setMsg(error ? "⚠ " + tradErroreDb(error.message) : "✅ Voti esclusi");
    carica();
  };

  const votiCompagniPerVotante = {};
  votiCompagni.forEach((v) => { (votiCompagniPerVotante[v.votante_id] ||= []).push(v); });

  if (!squadreAltrui.length && !mieSquadre.length) return null;

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

      {Object.keys(votiCompagniPerVotante).length > 0 && (
        <div style={{ marginTop: 16 }}>
          <h3>Voti dei tuoi compagni</h3>
          <p className="season">
            Se un compagno ha votato a caso (es. 6.5 a tutti), puoi escludere i suoi voti da
            questa partita — non tocca le sue presenze, gol o altre statistiche, solo
            l'affidabilità di questi voti specifici.
          </p>
          {Object.entries(votiCompagniPerVotante).map(([votanteId, righe]) => {
            const nomeVotante = giocatori[votanteId]?.nickname || giocatori[votanteId]?.nome || `#${votanteId}`;
            const qualcunoValido = righe.some((r) => !r.anomalo);
            return (
              <div key={votanteId} style={{ marginTop: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <b className="pname">{nomeVotante}</b>
                  {qualcunoValido && (
                    <button className="mini no" disabled={busyId === `t${votanteId}`}
                      onClick={() => escludiTuttiDiVotante(Number(votanteId))}>
                      Escludi tutti i voti di {nomeVotante} in questa partita
                    </button>
                  )}
                </div>
                <div style={{ overflowX: "auto" }}>
                  <table>
                    <thead><tr><th>Ha votato</th><th className="num">Voto</th><th>Stato</th><th></th></tr></thead>
                    <tbody>
                      {righe.map((v) => (
                        <tr key={v.id}>
                          <td className="pname">{giocatori[v.valutato_id]?.nickname || giocatori[v.valutato_id]?.nome || `#${v.valutato_id}`}</td>
                          <td className="num">{v.voto}</td>
                          <td>{v.anomalo ? "❌ escluso" : "✅ valido"}</td>
                          <td>
                            {v.anomalo ? (
                              <button className="mini" disabled={busyId === `v${v.id}`} onClick={() => ripristinaVoto(v.id)}>Ripristina</button>
                            ) : (
                              <button className="mini no" disabled={busyId === `v${v.id}`} onClick={() => escludiVoto(v.id)}>Escludi questo voto</button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {msg && <div className="note">{msg}</div>}
    </div>
  );
}
