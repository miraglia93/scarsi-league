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
  const [prestazioniConteggio, setPrestazioniConteggio] = useState({}); // partita_id -> n. prestazioni
  const [msg, setMsg] = useState("");
  const [nomeLega, setNomeLega] = useState("");
  const [slugLega, setSlugLega] = useState("");

  // ---------- dati partita ----------
  const [partitaSelId, setPartitaSelId] = useState("");
  const [datiRighe, setDatiRighe] = useState([]);
  const [datiMsg, setDatiMsg] = useState("");
  const [datiBusy, setDatiBusy] = useState(false);

  // ---------- gestione partite ----------
  const [spostaBusy, setSpostaBusy] = useState(null); // id partita in corso di spostamento

  // ---------- gestione stagioni ----------
  const [stagioneModifiche, setStagioneModifiche] = useState({}); // id -> { nome, fine }
  const [nuovaStagioneLega, setNuovaStagioneLega] = useState("");
  const [nuovaStagioneNome, setNuovaStagioneNome] = useState("");
  const [nuovaStagioneInizio, setNuovaStagioneInizio] = useState("");
  const [nuovaStagioneFine, setNuovaStagioneFine] = useState("");
  const [stagioneBusy, setStagioneBusy] = useState(null);

  // ---------- eliminazione con conferma forte ----------
  const [eliminaTarget, setEliminaTarget] = useState(null); // { tipo: 'partita'|'stagione', id, label, extra }
  const [eliminaTesto, setEliminaTesto] = useState("");
  const [eliminaBusy, setEliminaBusy] = useState(false);

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
    const [r, m, l, pa, gi, st, pr, prc] = await Promise.all([
      supabase.from("richieste_accesso").select("*").order("richiesta_il", { ascending: false }),
      supabase.from("membri_autorizzati").select("*").order("aggiunto_il"),
      supabase.from("leghe").select("*").order("id"),
      supabase.from("partite").select("*").order("data", { ascending: false }),
      supabase.from("giocatori").select("*").order("nome"),
      supabase.from("stagioni").select("*").order("inizio", { ascending: false }),
      supabase.from("premi").select("*").order("assegnato_il", { ascending: false }),
      supabase.from("prestazioni").select("partita_id"),
    ]);
    setRichieste(r.data || []);
    setMembri(m.data || []);
    setLeghe(l.data || []);
    setPartite(pa.data || []);
    setGiocatori(gi.data || []);
    setStagioni(st.data || []);
    setPremiList(pr.data || []);
    const conteggio = {};
    (prc.data || []).forEach((row) => { conteggio[row.partita_id] = (conteggio[row.partita_id] || 0) + 1; });
    setPrestazioniConteggio(conteggio);
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
      // eslint-disable-next-line react-hooks/exhaustive-deps
    })();
  }, [partitaSelId]); // solo al cambio partita: un refresh di "giocatori" da un'altra azione admin non deve azzerare modifiche non salvate

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

  // ---------- gestione partite ----------
  const spostaPartita = async (partitaId, nuovaStagioneId) => {
    setSpostaBusy(partitaId); setMsg("");
    const { error } = await supabase.from("partite")
      .update({ stagione_id: nuovaStagioneId ? Number(nuovaStagioneId) : null })
      .eq("id", partitaId);
    setSpostaBusy(null);
    setMsg(error ? "⚠ " + error.message : "✅ Partita spostata di stagione");
    carica();
  };

  // ---------- gestione stagioni ----------
  const modificaStagioneCampo = (id, campo, valore) => {
    setStagioneModifiche((m) => ({ ...m, [id]: { ...m[id], [campo]: valore } }));
  };

  const salvaStagione = async (s) => {
    const mod = stagioneModifiche[s.id];
    if (!mod) return;
    setStagioneBusy(s.id); setMsg("");
    const { error } = await supabase.from("stagioni").update({
      nome: mod.nome ?? s.nome,
      fine: mod.fine !== undefined ? (mod.fine || null) : s.fine,
    }).eq("id", s.id);
    setStagioneBusy(null);
    setMsg(error ? "⚠ " + error.message : "✅ Stagione aggiornata");
    if (!error) setStagioneModifiche((m) => { const n = { ...m }; delete n[s.id]; return n; });
    carica();
  };

  const impostaAttiva = async (s) => {
    setStagioneBusy(s.id); setMsg("");
    const { error: e1 } = await supabase.from("stagioni")
      .update({ attiva: false }).eq("lega_id", s.lega_id).eq("attiva", true);
    if (e1) { setStagioneBusy(null); setMsg("⚠ " + e1.message); return; }
    const { error: e2 } = await supabase.from("stagioni").update({ attiva: true }).eq("id", s.id);
    setStagioneBusy(null);
    setMsg(e2 ? "⚠ " + e2.message : "✅ Stagione impostata come attiva");
    carica();
  };

  const chiudiStagione = async (s) => {
    setStagioneBusy(s.id); setMsg("");
    const oggi = new Date().toISOString().slice(0, 10);
    const { error } = await supabase.from("stagioni").update({ fine: oggi }).eq("id", s.id);
    setStagioneBusy(null);
    setMsg(error ? "⚠ " + error.message : "✅ Stagione chiusa");
    carica();
  };

  const creaStagione = async () => {
    if (!nuovaStagioneLega || !nuovaStagioneNome || !nuovaStagioneInizio) {
      setMsg("⚠ Compila lega, nome e data di inizio della stagione.");
      return;
    }
    const { error } = await supabase.from("stagioni").insert({
      lega_id: Number(nuovaStagioneLega),
      nome: nuovaStagioneNome,
      inizio: nuovaStagioneInizio,
      fine: nuovaStagioneFine || null,
      attiva: false,
    });
    setMsg(error ? "⚠ " + error.message : "✅ Stagione creata");
    if (!error) { setNuovaStagioneNome(""); setNuovaStagioneInizio(""); setNuovaStagioneFine(""); }
    carica();
  };

  // ---------- eliminazione con conferma forte (digitare ELIMINA) ----------
  const apriElimina = (tipo, id, label, extra) => {
    setEliminaTarget({ tipo, id, label, extra });
    setEliminaTesto("");
  };

  const confermaElimina = async () => {
    if (!eliminaTarget || eliminaTesto !== "ELIMINA") return;
    setEliminaBusy(true);
    let error, logNote;

    if (eliminaTarget.tipo === "partita") {
      const nPrest = prestazioniConteggio[eliminaTarget.id] || 0;
      ({ error } = await supabase.from("partite").delete().eq("id", eliminaTarget.id));
      logNote = `Eliminata partita #${eliminaTarget.id} (${eliminaTarget.label}): ${nPrest} prestazioni, voti e dati manuali collegati rimossi a cascata.`;
    } else if (eliminaTarget.tipo === "stagione") {
      ({ error } = await supabase.from("stagioni").delete().eq("id", eliminaTarget.id));
      logNote = `Eliminata stagione "${eliminaTarget.label}" (nessuna partita collegata).`;
    }

    if (!error) {
      await supabase.from("import_log").insert({ fonte: "admin-ui", errori: logNote });
    }
    setEliminaBusy(false);
    setMsg(error ? "⚠ " + error.message : "✅ Eliminazione completata");
    setEliminaTarget(null);
    carica();
  };

  if (stato === "verifica") return <div className="centered">Verifica permessi…</div>;
  if (stato === "no-login") return <div className="centered"><a className="plink" href="/">Fai login per continuare</a></div>;
  if (stato === "no-admin") return <div className="centered">Solo l&apos;admin può accedere a questa pagina. <a className="plink" href="/">← Torna alla lega</a></div>;

  const inAttesa = richieste.filter((r) => r.stato === "in_attesa");
  const gestite = richieste.filter((r) => r.stato !== "in_attesa");

  const partitaLabel = (p) => `${p.data} · ${p.squadra_1} ${p.gol_squadra_1}-${p.gol_squadra_2} ${p.squadra_2}`;
  const partiteCountByStagione = {};
  partite.forEach((p) => { if (p.stagione_id) partiteCountByStagione[p.stagione_id] = (partiteCountByStagione[p.stagione_id] || 0) + 1; });

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

      <h2>Stagioni ({stagioni.length})</h2>
      <table>
        <thead><tr>
          <th>Nome</th><th>Inizio</th><th>Fine</th><th>Stato</th><th className="num">Partite</th><th>Azioni</th>
        </tr></thead>
        <tbody>
          {stagioni.map((s) => {
            const mod = stagioneModifiche[s.id] || {};
            const nPartite = partiteCountByStagione[s.id] || 0;
            const busy = stagioneBusy === s.id;
            return (
              <tr key={s.id}>
                <td><input type="text" value={mod.nome ?? s.nome}
                  onChange={(e) => modificaStagioneCampo(s.id, "nome", e.target.value)} /></td>
                <td>{s.inizio}</td>
                <td><input type="date" value={mod.fine ?? s.fine ?? ""}
                  onChange={(e) => modificaStagioneCampo(s.id, "fine", e.target.value)} /></td>
                <td>{s.attiva ? "🟢 attiva" : "conclusa"}</td>
                <td className="num">{nPartite}</td>
                <td style={{ whiteSpace: "nowrap" }}>
                  <button className="mini ok" disabled={busy || !stagioneModifiche[s.id]} onClick={() => salvaStagione(s)}>💾</button>{" "}
                  {!s.attiva && <button className="mini" disabled={busy} onClick={() => impostaAttiva(s)}>Imposta attiva</button>}{" "}
                  {!s.fine && <button className="mini" disabled={busy} onClick={() => chiudiStagione(s)}>Chiudi</button>}{" "}
                  <button className="mini no" disabled={nPartite > 0}
                    title={nPartite > 0 ? "Sposta o elimina prima le partite collegate" : ""}
                    onClick={() => apriElimina("stagione", s.id, s.nome)}>Elimina</button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="betaform">
        <h3>Crea nuova stagione</h3>
        <select value={nuovaStagioneLega} onChange={(e) => setNuovaStagioneLega(e.target.value)}>
          <option value="">— Lega —</option>
          {leghe.map((l) => <option key={l.id} value={l.id}>{l.nome}</option>)}
        </select>
        <input placeholder="Nome — es. 2027/28" value={nuovaStagioneNome} onChange={(e) => setNuovaStagioneNome(e.target.value)} />
        <label className="flabel">Data inizio</label>
        <input type="date" value={nuovaStagioneInizio} onChange={(e) => setNuovaStagioneInizio(e.target.value)} />
        <label className="flabel">Data fine (opzionale)</label>
        <input type="date" value={nuovaStagioneFine} onChange={(e) => setNuovaStagioneFine(e.target.value)} />
        <button className="mini ok" style={{ marginTop: 10 }} onClick={creaStagione}
          disabled={!nuovaStagioneLega || !nuovaStagioneNome || !nuovaStagioneInizio}>+ Crea stagione</button>
      </div>

      <h2>Partite ({partite.length})</h2>
      <div style={{ overflowX: "auto" }}>
        <table>
          <thead><tr>
            <th>Data</th><th>Squadre</th><th>Risultato</th><th>Stagione</th><th className="num">Prestazioni</th><th>Azioni</th>
          </tr></thead>
          <tbody>
            {partite.map((p) => (
              <tr key={p.id}>
                <td>{p.data}</td>
                <td className="pname">{p.squadra_1} – {p.squadra_2}</td>
                <td className="num">{p.gol_squadra_1}-{p.gol_squadra_2}</td>
                <td>
                  <select value={p.stagione_id ?? ""} disabled={spostaBusy === p.id}
                    onChange={(e) => spostaPartita(p.id, e.target.value)}>
                    <option value="">— nessuna —</option>
                    {stagioni.filter((s) => s.lega_id === p.lega_id).map((s) => (
                      <option key={s.id} value={s.id}>{s.nome}</option>
                    ))}
                  </select>
                </td>
                <td className="num">{prestazioniConteggio[p.id] || 0}</td>
                <td>
                  <button className="mini no" onClick={() => apriElimina(
                    "partita", p.id, `${p.data} · ${p.squadra_1} ${p.gol_squadra_1}-${p.gol_squadra_2} ${p.squadra_2}`,
                  )}>Elimina</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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

      {eliminaTarget && (
        <div className="modalback" onClick={() => setEliminaTarget(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>⚠ Eliminazione definitiva</h3>
            {eliminaTarget.tipo === "partita" ? (
              <p>
                Stai per eliminare la partita <b>{eliminaTarget.label}</b>. Verranno eliminate a
                cascata anche <b>{prestazioniConteggio[eliminaTarget.id] || 0} prestazioni</b>, i
                voti individuali e i dati manuali collegati. L&apos;operazione non è reversibile.
              </p>
            ) : (
              <p>
                Stai per eliminare la stagione <b>{eliminaTarget.label}</b>. Non ha partite
                collegate, quindi non verrà eliminato altro. L&apos;operazione non è reversibile.
              </p>
            )}
            <p className="season">Digita <b>ELIMINA</b> per confermare</p>
            <input type="text" value={eliminaTesto} onChange={(e) => setEliminaTesto(e.target.value)}
              placeholder="ELIMINA" autoFocus />
            <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
              <button className="mini no" disabled={eliminaTesto !== "ELIMINA" || eliminaBusy} onClick={confermaElimina}>
                {eliminaBusy ? "Eliminazione…" : "Elimina definitivamente"}
              </button>
              <button className="mini" onClick={() => setEliminaTarget(null)}>Annulla</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
