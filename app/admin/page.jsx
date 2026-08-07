"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

export default function Admin() {
  const [stato, setStato] = useState("verifica"); // verifica | no-login | no-admin | ok
  const [richieste, setRichieste] = useState([]);
  const [membri, setMembri] = useState([]);
  const [leghe, setLeghe] = useState([]);
  const [partite, setPartite] = useState([]);
  const [giocatori, setGiocatori] = useState([]);
  const [stagioni, setStagioni] = useState([]);
  const [premiList, setPremiList] = useState([]);
  const [msg, setMsg] = useState("");
  const [nomeLega, setNomeLega] = useState("");
  const [slugLega, setSlugLega] = useState("");

  // ---------- dati partita ----------
  const [partitaSelId, setPartitaSelId] = useState("");
  const [datiRighe, setDatiRighe] = useState([]);
  const [datiMsg, setDatiMsg] = useState("");
  const [datiBusy, setDatiBusy] = useState(false);

  // ---------- premi ----------
  const [premioGiocatore, setPremioGiocatore] = useState("");
  const [premioTipo, setPremioTipo] = useState("");
  const [premioPeriodo, setPremioPeriodo] = useState("partita");
  const [premioPartitaId, setPremioPartitaId] = useState("");
  const [premioStagioneId, setPremioStagioneId] = useState("");
  const [premioEtichetta, setPremioEtichetta] = useState("");
  const [premioEmoji, setPremioEmoji] = useState("");
  const [premioMsg, setPremioMsg] = useState("");

  const carica = async () => {
    const [r, m, l, pa, gi, st, pr] = await Promise.all([
      supabase.from("richieste_accesso").select("*").order("richiesta_il", { ascending: false }),
      supabase.from("membri_autorizzati").select("*").order("aggiunto_il"),
      supabase.from("leghe").select("*").order("id"),
      supabase.from("partite").select("*").order("data", { ascending: false }),
      supabase.from("giocatori").select("*").order("nome"),
      supabase.from("stagioni").select("*").order("inizio", { ascending: false }),
      supabase.from("premi").select("*").order("assegnato_il", { ascending: false }),
    ]);
    setRichieste(r.data || []);
    setMembri(m.data || []);
    setLeghe(l.data || []);
    setPartite(pa.data || []);
    setGiocatori(gi.data || []);
    setStagioni(st.data || []);
    setPremiList(pr.data || []);
  };

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setStato("no-login"); return; }
      const mail = (session.user?.email || "").toLowerCase();
      const { data: me } = await supabase.from("membri_autorizzati")
        .select("ruolo").eq("email", mail).maybeSingle();
      if (me?.ruolo !== "admin") { setStato("no-admin"); return; }
      setStato("ok");
      carica();
    })();
  }, []);

  useEffect(() => {
    if (!partitaSelId) { setDatiRighe([]); return; }
    (async () => {
      const [{ data: pr }, { data: dm }] = await Promise.all([
        supabase.from("prestazioni").select("*").eq("partita_id", partitaSelId),
        supabase.from("dati_manuali").select("*").eq("partita_id", partitaSelId),
      ]);
      const dmByGiocatore = {};
      (dm || []).forEach((d) => { dmByGiocatore[d.giocatore_id] = d; });
      const righe = (pr || []).map((p) => {
        const g = giocatori.find((x) => x.id === p.giocatore_id);
        const esistente = dmByGiocatore[p.giocatore_id];
        return {
          giocatore_id: p.giocatore_id,
          nome: g?.nickname || g?.nome || "Giocatore",
          ruolo: p.ruolo || g?.ruolo_prevalente || "—",
          assist: esistente?.assist ?? 0,
          clean_sheet: esistente?.clean_sheet ?? false,
          gol_subiti: esistente?.gol_subiti ?? "",
          cartellini: esistente?.cartellini ?? 0,
          autogol: esistente?.autogol ?? 0,
          note: esistente?.note ?? "",
        };
      }).sort((a, b) => a.nome.localeCompare(b.nome));
      setDatiRighe(righe);
      setDatiMsg("");
    })();
  }, [partitaSelId, giocatori]);

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

  const aggiornaRiga = (giocatoreId, campo, valore) => {
    setDatiRighe((righe) => righe.map((r) => (r.giocatore_id === giocatoreId ? { ...r, [campo]: valore } : r)));
  };

  const salvaDati = async () => {
    setDatiBusy(true); setDatiMsg("");
    const payload = datiRighe.map((r) => ({
      partita_id: Number(partitaSelId),
      giocatore_id: r.giocatore_id,
      assist: Number(r.assist) || 0,
      clean_sheet: !!r.clean_sheet,
      gol_subiti: r.gol_subiti === "" ? null : Number(r.gol_subiti),
      cartellini: Number(r.cartellini) || 0,
      autogol: Number(r.autogol) || 0,
      note: r.note || null,
    }));
    const { error } = await supabase.from("dati_manuali").upsert(payload, { onConflict: "partita_id,giocatore_id" });
    setDatiBusy(false);
    setDatiMsg(error ? "⚠ " + error.message : "✅ Dati salvati");
  };

  const assegnaPremio = async () => {
    setPremioMsg("");
    if (!premioGiocatore || !premioTipo || !premioEtichetta) {
      setPremioMsg("⚠ Compila giocatore, tipo ed etichetta.");
      return;
    }
    const legaGiocatore = giocatori.find((g) => g.id === Number(premioGiocatore))?.lega_id;
    const { error } = await supabase.from("premi").insert({
      lega_id: legaGiocatore,
      giocatore_id: Number(premioGiocatore),
      tipo: premioTipo,
      periodo: premioPeriodo,
      partita_id: premioPeriodo === "partita" && premioPartitaId ? Number(premioPartitaId) : null,
      stagione_id: (premioPeriodo === "stagione" || premioPeriodo === "mese") && premioStagioneId ? Number(premioStagioneId) : null,
      etichetta: premioEtichetta,
      emoji: premioEmoji || null,
    });
    if (error) { setPremioMsg("⚠ " + error.message); return; }
    setPremioMsg("✅ Premio assegnato");
    setPremioGiocatore(""); setPremioTipo(""); setPremioEtichetta(""); setPremioEmoji("");
    setPremioPartitaId(""); setPremioStagioneId("");
    carica();
  };

  const rimuoviPremio = async (id) => {
    if (!confirm("Rimuovere questo premio?")) return;
    const { error } = await supabase.from("premi").delete().eq("id", id);
    setPremioMsg(error ? "⚠ " + error.message : "✅ Premio rimosso");
    carica();
  };

  if (stato === "verifica") return <div className="centered">Verifica permessi…</div>;
  if (stato === "no-login") return <div className="centered"><a className="plink" href="/">Fai login per continuare</a></div>;
  if (stato === "no-admin") return <div className="centered">Solo l&apos;admin può accedere a questa pagina. <a className="plink" href="/">← Torna alla lega</a></div>;

  const inAttesa = richieste.filter((r) => r.stato === "in_attesa");
  const gestite = richieste.filter((r) => r.stato !== "in_attesa");

  const partitaLabel = (p) => `${p.data} · ${p.squadra_1} ${p.gol_squadra_1}-${p.gol_squadra_2} ${p.squadra_2}`;

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

      <h2>Dati partita</h2>
      <p className="season">Assist, clean sheet, cartellini, autogol — Fubles non li espone, li inserisci tu.</p>
      <select value={partitaSelId} onChange={(e) => setPartitaSelId(e.target.value)}>
        <option value="">— Scegli una partita —</option>
        {partite.map((p) => <option key={p.id} value={p.id}>{partitaLabel(p)}</option>)}
      </select>

      {partitaSelId && (
        datiRighe.length === 0 ? (
          <p className="season">Nessun partecipante trovato per questa partita.</p>
        ) : (
          <>
            <div style={{ overflowX: "auto" }}>
              <table>
                <thead><tr>
                  <th>Giocatore</th><th>Ruolo</th><th className="num">Assist</th><th className="num">Clean sheet</th>
                  <th className="num">Gol subiti</th><th className="num">Cartellini</th><th className="num">Autogol</th><th>Note</th>
                </tr></thead>
                <tbody>
                  {datiRighe.map((r) => (
                    <tr key={r.giocatore_id}>
                      <td className="pname">{r.nome}</td>
                      <td>{r.ruolo}</td>
                      <td className="num">
                        <input type="number" min="0" value={r.assist}
                          onChange={(e) => aggiornaRiga(r.giocatore_id, "assist", e.target.value)} />
                      </td>
                      <td className="num">
                        <input type="checkbox" checked={r.clean_sheet}
                          onChange={(e) => aggiornaRiga(r.giocatore_id, "clean_sheet", e.target.checked)} />
                      </td>
                      <td className="num">
                        {r.ruolo === "POR"
                          ? <input type="number" min="0" value={r.gol_subiti}
                              onChange={(e) => aggiornaRiga(r.giocatore_id, "gol_subiti", e.target.value)} />
                          : "—"}
                      </td>
                      <td className="num">
                        <input type="number" min="0" value={r.cartellini}
                          onChange={(e) => aggiornaRiga(r.giocatore_id, "cartellini", e.target.value)} />
                      </td>
                      <td className="num">
                        <input type="number" min="0" value={r.autogol}
                          onChange={(e) => aggiornaRiga(r.giocatore_id, "autogol", e.target.value)} />
                      </td>
                      <td>
                        <input type="text" value={r.note}
                          onChange={(e) => aggiornaRiga(r.giocatore_id, "note", e.target.value)} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button className="mini ok" style={{ marginTop: 12 }} onClick={salvaDati} disabled={datiBusy}>
              {datiBusy ? "Salvataggio…" : "💾 Salva dati partita"}
            </button>
            {datiMsg && <div className="note">{datiMsg}</div>}
          </>
        )
      )}

      <h2>Premi</h2>
      <div className="betaform">
        <h3>Assegna un premio</h3>
        <select value={premioGiocatore} onChange={(e) => setPremioGiocatore(e.target.value)}>
          <option value="">— Giocatore —</option>
          {giocatori.map((g) => <option key={g.id} value={g.id}>{g.nickname || g.nome}</option>)}
        </select>
        <input placeholder='Tipo — es. "miglior_portiere", "gol_del_mese"' value={premioTipo} onChange={(e) => setPremioTipo(e.target.value)} />
        <select value={premioPeriodo} onChange={(e) => setPremioPeriodo(e.target.value)}>
          <option value="partita">Partita</option>
          <option value="mese">Mese</option>
          <option value="stagione">Stagione</option>
        </select>
        {premioPeriodo === "partita" && (
          <select value={premioPartitaId} onChange={(e) => setPremioPartitaId(e.target.value)}>
            <option value="">— Partita —</option>
            {partite.map((p) => <option key={p.id} value={p.id}>{partitaLabel(p)}</option>)}
          </select>
        )}
        {(premioPeriodo === "stagione" || premioPeriodo === "mese") && (
          <select value={premioStagioneId} onChange={(e) => setPremioStagioneId(e.target.value)}>
            <option value="">— Stagione —</option>
            {stagioni.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
          </select>
        )}
        <input placeholder='Etichetta mostrata — es. "MVP di Settembre"' value={premioEtichetta} onChange={(e) => setPremioEtichetta(e.target.value)} />
        <input placeholder="Emoji (opzionale) — es. 🧤" value={premioEmoji} onChange={(e) => setPremioEmoji(e.target.value)} style={{ maxWidth: 120 }} />
        <button className="mini ok" style={{ marginTop: 10 }} onClick={assegnaPremio}>+ Assegna premio</button>
        {premioMsg && <div className="note">{premioMsg}</div>}
      </div>

      <h3 style={{ marginTop: 24 }}>Premi assegnati ({premiList.length})</h3>
      {premiList.length === 0 ? (
        <p className="season">Nessun premio assegnato ancora.</p>
      ) : (
        <table>
          <thead><tr><th>Giocatore</th><th>Etichetta</th><th>Periodo</th><th>Quando</th><th></th></tr></thead>
          <tbody>
            {premiList.map((p) => {
              const g = giocatori.find((x) => x.id === p.giocatore_id);
              return (
                <tr key={p.id}>
                  <td className="pname">{g?.nickname || g?.nome || "—"}</td>
                  <td>{p.emoji ? `${p.emoji} ` : ""}{p.etichetta || p.tipo}</td>
                  <td>{p.periodo || "—"}</td>
                  <td>{new Date(p.assegnato_il).toLocaleDateString("it-IT")}</td>
                  <td><button className="mini no" onClick={() => rimuoviPremio(p.id)}>Rimuovi</button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
