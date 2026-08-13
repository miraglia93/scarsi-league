"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { tradErroreDb } from "../lib/engine";
import {
  parseImportFubles, calcolaAnteprimaImport, partiteDaInserire as calcolaPartiteDaInserire,
  trovaGiocatoriNuovi, costruisciPrestazioni, costruisciVoti, parseImportRapido,
} from "../lib/importFubles";
import { bookmarkletHref } from "../lib/bookmarklet";
import SubTabs from "./SubTabs";

// tutta la gestione di UNA lega (import, accessi, stagioni, premi):
// montato dentro la sezione "Lega" per chi è admin di quella lega
// specifica, e anche dalla pagina /admin standalone. legaId è sempre
// quello scelto dal selettore in alto — qui non si cambia lega.
export default function PannelloGestioneLega({ legaId, ruoloUtente }) {
  const isAdmin = ruoloUtente === "admin";
  const [sezioneAdmin, setSezioneAdmin] = useState("partite"); // partite | accessi | struttura | premi
  const [legaCorrente, setLegaCorrente] = useState(null);
  const [richieste, setRichieste] = useState([]);
  const [membri, setMembri] = useState([]);
  const [partite, setPartite] = useState([]);
  const [giocatori, setGiocatori] = useState([]);
  const [stagioni, setStagioni] = useState([]);
  const [premiList, setPremiList] = useState([]);
  const [prestazioniConteggio, setPrestazioniConteggio] = useState({}); // partita_id -> n. prestazioni
  const [msg, setMsg] = useState("");

  // ---------- info lega (struttura sportiva, orario) ----------
  const [infoStruttura, setInfoStruttura] = useState("");
  const [infoOrario, setInfoOrario] = useState("");
  const [infoBusy, setInfoBusy] = useState(false);

  // ---------- dati partita ----------
  const [partitaSelId, setPartitaSelId] = useState("");
  const [datiRighe, setDatiRighe] = useState([]);
  const [datiMsg, setDatiMsg] = useState("");
  const [datiBusy, setDatiBusy] = useState(false);

  // ---------- gestione partite ----------
  const [spostaBusy, setSpostaBusy] = useState(null); // id partita in corso di spostamento

  // ---------- gestione stagioni ----------
  const [stagioneModifiche, setStagioneModifiche] = useState({}); // id -> { nome, fine }
  const [nuovaStagioneNome, setNuovaStagioneNome] = useState("");
  const [nuovaStagioneInizio, setNuovaStagioneInizio] = useState("");
  const [nuovaStagioneFine, setNuovaStagioneFine] = useState("");
  const [stagioneBusy, setStagioneBusy] = useState(null);

  // ---------- eliminazione con conferma forte ----------
  const [eliminaTarget, setEliminaTarget] = useState(null); // { tipo: 'partita'|'stagione'|'lega', id, label }
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

  // ---------- import manuale Fubles ----------
  const [importPartiteText, setImportPartiteText] = useState("");
  const [importPrestazioniText, setImportPrestazioniText] = useState("");
  const [importVotiText, setImportVotiText] = useState("");
  const [importPreview, setImportPreview] = useState(null);
  const [importMsg, setImportMsg] = useState("");
  const [importBusy, setImportBusy] = useState(false);

  // ---------- import rapido (bookmarklet, una partita alla volta) ----------
  const [importRapidoText, setImportRapidoText] = useState("");
  const [importRapidoPreview, setImportRapidoPreview] = useState(null);
  const [importRapidoMsg, setImportRapidoMsg] = useState("");
  const [importRapidoBusy, setImportRapidoBusy] = useState(false);

  const carica = async () => {
    if (legaId == null) return;
    const [le, r, m, pa, gi, st, pr, prc] = await Promise.all([
      supabase.from("leghe").select("*").eq("id", legaId).maybeSingle(),
      supabase.from("richieste_accesso").select("*").eq("lega_id", legaId).order("richiesta_il", { ascending: false }),
      supabase.from("membri_autorizzati").select("*").eq("lega_id", legaId).order("aggiunto_il"),
      supabase.from("partite").select("*").eq("lega_id", legaId).order("data", { ascending: false }),
      supabase.from("giocatori").select("*").eq("lega_id", legaId).order("nome"),
      supabase.from("stagioni").select("*").eq("lega_id", legaId).order("inizio", { ascending: false }),
      supabase.from("premi").select("*").eq("lega_id", legaId).order("assegnato_il", { ascending: false }),
      supabase.from("prestazioni").select("partita_id"),
    ]);
    setLegaCorrente(le.data || null);
    setRichieste(r.data || []);
    setMembri(m.data || []);
    setPartite(pa.data || []);
    setGiocatori(gi.data || []);
    setStagioni(st.data || []);
    setPremiList(pr.data || []);
    const conteggio = {};
    (prc.data || []).forEach((row) => { conteggio[row.partita_id] = (conteggio[row.partita_id] || 0) + 1; });
    setPrestazioniConteggio(conteggio);
  };

  useEffect(() => { carica(); }, [legaId]);

  useEffect(() => {
    if (legaCorrente) { setInfoStruttura(legaCorrente.struttura || ""); setInfoOrario(legaCorrente.orario || ""); }
  }, [legaCorrente?.id]);

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
  }, [partitaSelId]);

  const azione = async (fn, email) => {
    setMsg("");
    const { data, error } = await supabase.rpc(fn, { p_email: email, p_lega_id: legaId });
    if (error || data !== "ok") setMsg("⚠ " + (error ? tradErroreDb(error.message) : data));
    else setMsg("✅ Fatto");
    carica();
  };

  const revoca = async (email) => {
    if (!confirm(`Revocare l'accesso a ${email}?`)) return;
    const { error } = await supabase.from("membri_autorizzati").delete().eq("email", email).eq("lega_id", legaId);
    setMsg(error ? "⚠ " + tradErroreDb(error.message) : "✅ Accesso revocato");
    carica();
  };

  const cambiaRuolo = async (email, ruolo) => {
    const { error } = await supabase.from("membri_autorizzati").update({ ruolo }).eq("email", email).eq("lega_id", legaId);
    setMsg(error ? "⚠ " + tradErroreDb(error.message) : "✅ Ruolo aggiornato");
    carica();
  };

  const togglePubblica = async (valore) => {
    const { error } = await supabase.from("leghe").update({ pubblica: valore }).eq("id", legaId);
    setMsg(error ? "⚠ " + tradErroreDb(error.message) : (valore ? "✅ Lega visibile in /leghe" : "✅ Lega tornata privata"));
    carica();
  };

  const salvaInfoLega = async () => {
    setInfoBusy(true);
    const { error } = await supabase.from("leghe")
      .update({ struttura: infoStruttura || null, orario: infoOrario || null }).eq("id", legaId);
    setInfoBusy(false);
    setMsg(error ? "⚠ " + tradErroreDb(error.message) : "✅ Info lega aggiornate");
    carica();
  };

  // ---------- import manuale Fubles ----------
  const analizzaImport = () => {
    setImportMsg("");
    const parsed = parseImportFubles({
      partiteText: importPartiteText, prestazioniText: importPrestazioniText, votiText: importVotiText, legaId,
    });
    if (parsed.errori.length) { setImportPreview(null); setImportMsg("⚠ " + parsed.errori.join(" · ")); return; }
    setImportPreview({ parsed, ...calcolaAnteprimaImport(parsed, partite, giocatori) });
  };

  const confermaImport = async () => {
    if (!importPreview) return;
    setImportBusy(true); setImportMsg("");
    const { parsed, nuoveMatchIds } = importPreview;
    try {
      const nuovePartite = calcolaPartiteDaInserire(parsed, nuoveMatchIds);
      let matchIdAId = {};
      if (nuovePartite.length) {
        const { data: inserite, error } = await supabase.from("partite").insert(nuovePartite).select("id, match_id");
        if (error) throw error;
        (inserite || []).forEach((p) => { matchIdAId[p.match_id] = p.id; });
      }

      const fublesIdAId = {};
      giocatori.forEach((g) => { if (g.fubles_user_id) fublesIdAId[g.fubles_user_id] = g.id; });
      const nuoviGiocatori = trovaGiocatoriNuovi(parsed, giocatori);
      if (nuoviGiocatori.length) {
        const { data: creati, error } = await supabase.from("giocatori").insert(
          nuoviGiocatori.map((g) => ({
            nome: g.nome, lega_id: legaId, fubles_user_id: g.fubles_user_id,
            fubles_url: g.fubles_url, ruolo_prevalente: g.ruolo_prevalente, foto_disponibile: g.foto_disponibile,
          })),
        ).select("id, fubles_user_id");
        if (error) throw error;
        (creati || []).forEach((g) => { fublesIdAId[g.fubles_user_id] = g.id; });
      }

      const nuovePrestazioni = costruisciPrestazioni(parsed, nuoveMatchIds, matchIdAId, fublesIdAId);
      if (nuovePrestazioni.length) {
        const { error } = await supabase.from("prestazioni").upsert(nuovePrestazioni, { onConflict: "partita_id,giocatore_id" });
        if (error) throw error;
      }

      const nuoviVoti = costruisciVoti(parsed, nuoveMatchIds, matchIdAId, fublesIdAId);
      if (nuoviVoti.length) {
        const { error } = await supabase.from("voti_ricevuti").insert(nuoviVoti);
        if (error) throw error;
      }

      await supabase.from("import_log").insert({
        fonte: "admin-ui-import",
        errori: `Import manuale: ${nuovePartite.length} partite, ${nuoviGiocatori.length} giocatori nuovi, ${nuovePrestazioni.length} prestazioni, ${nuoviVoti.length} voti.`,
      });

      setImportMsg(`✅ Importate ${nuovePartite.length} partite, ${nuoviGiocatori.length} giocatori nuovi, ${nuovePrestazioni.length} prestazioni, ${nuoviVoti.length} voti.`);
      setImportPreview(null);
      setImportPartiteText(""); setImportPrestazioniText(""); setImportVotiText("");
      carica();
    } catch (error) {
      setImportMsg("⚠ " + tradErroreDb(error.message));
    }
    setImportBusy(false);
  };

  // ---------- import rapido (bookmarklet, senza id Fubles) ----------
  const analizzaImportRapido = () => {
    setImportRapidoMsg("");
    let dati;
    try {
      dati = JSON.parse(importRapidoText);
    } catch {
      setImportRapidoPreview(null);
      setImportRapidoMsg("⚠ Il testo incollato non è JSON valido — assicurati di aver incollato esattamente quello che il bottone ha copiato.");
      return;
    }
    const risultato = parseImportRapido(dati, { legaId, partiteEsistenti: partite, giocatoriEsistenti: giocatori });
    if (risultato.errori.length) {
      setImportRapidoPreview(null);
      setImportRapidoMsg("⚠ " + risultato.errori.join(" · "));
      return;
    }
    setImportRapidoPreview(risultato);
  };

  const confermaImportRapido = async () => {
    if (!importRapidoPreview) return;
    setImportRapidoBusy(true); setImportRapidoMsg("");
    const { partita, giocatoriNuovi, prestazioni, voti } = importRapidoPreview;
    try {
      const { data: partitaInserita, error: errP } = await supabase.from("partite").insert(partita).select("id").single();
      if (errP) throw errP;
      const partitaId = partitaInserita.id;

      const nomeAId = {};
      giocatori.forEach((g) => { nomeAId[g.nome.trim().toLowerCase()] = g.id; });
      if (giocatoriNuovi.length) {
        const { data: creati, error: errG } = await supabase.from("giocatori").insert(
          giocatoriNuovi.map((g) => ({ nome: g.nome, lega_id: legaId, ruolo_prevalente: g.ruolo_prevalente })),
        ).select("id, nome");
        if (errG) throw errG;
        (creati || []).forEach((g) => { nomeAId[g.nome.trim().toLowerCase()] = g.id; });
      }

      const prestazioniRighe = prestazioni
        .map((p) => ({
          partita_id: partitaId, giocatore_id: nomeAId[p.nome.trim().toLowerCase()],
          squadra: p.squadra, ruolo: p.ruolo, voto: p.voto, gol: p.gol, motm: p.motm,
          esito: p.esito, gol_squadra: p.gol_squadra, gol_subiti: p.gol_subiti,
        }))
        .filter((p) => p.giocatore_id);
      if (prestazioniRighe.length) {
        const { error: errPr } = await supabase.from("prestazioni").upsert(prestazioniRighe, { onConflict: "partita_id,giocatore_id" });
        if (errPr) throw errPr;
      }

      const votiRighe = voti
        .map((v) => ({
          partita_id: partitaId, valutato_id: nomeAId[v.valutato_nome.trim().toLowerCase()],
          votante_id: nomeAId[v.votante_nome.trim().toLowerCase()], voto: v.voto,
        }))
        .filter((v) => v.valutato_id && v.votante_id);
      if (votiRighe.length) {
        const { error: errV } = await supabase.from("voti_ricevuti").insert(votiRighe);
        if (errV) throw errV;
      }

      await supabase.from("import_log").insert({
        fonte: "admin-ui-import-rapido",
        errori: `Import rapido (bookmarklet): 1 partita, ${giocatoriNuovi.length} giocatori nuovi, ${prestazioniRighe.length} prestazioni, ${votiRighe.length} voti.`,
      });

      setImportRapidoMsg(`✅ Importata: ${giocatoriNuovi.length} giocatori nuovi, ${prestazioniRighe.length} prestazioni, ${votiRighe.length} voti.`);
      setImportRapidoPreview(null);
      setImportRapidoText("");
      carica();
    } catch (error) {
      setImportRapidoMsg("⚠ " + tradErroreDb(error.message));
    }
    setImportRapidoBusy(false);
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
    setDatiMsg(error ? "⚠ " + tradErroreDb(error.message) : "✅ Dati salvati");
  };

  const assegnaPremio = async () => {
    setPremioMsg("");
    if (!premioGiocatore || !premioTipo || !premioEtichetta) {
      setPremioMsg("⚠ Compila giocatore, tipo ed etichetta.");
      return;
    }
    const { error } = await supabase.from("premi").insert({
      lega_id: legaId,
      giocatore_id: Number(premioGiocatore),
      tipo: premioTipo,
      periodo: premioPeriodo,
      partita_id: premioPeriodo === "partita" && premioPartitaId ? Number(premioPartitaId) : null,
      stagione_id: (premioPeriodo === "stagione" || premioPeriodo === "mese") && premioStagioneId ? Number(premioStagioneId) : null,
      etichetta: premioEtichetta,
      emoji: premioEmoji || null,
    });
    if (error) { setPremioMsg("⚠ " + tradErroreDb(error.message)); return; }
    setPremioMsg("✅ Premio assegnato");
    setPremioGiocatore(""); setPremioTipo(""); setPremioEtichetta(""); setPremioEmoji("");
    setPremioPartitaId(""); setPremioStagioneId("");
    carica();
  };

  const rimuoviPremio = async (id) => {
    if (!confirm("Rimuovere questo premio?")) return;
    const { error } = await supabase.from("premi").delete().eq("id", id);
    setPremioMsg(error ? "⚠ " + tradErroreDb(error.message) : "✅ Premio rimosso");
    carica();
  };

  // ---------- gestione partite ----------
  const spostaPartita = async (partitaId, nuovaStagioneId) => {
    setSpostaBusy(partitaId); setMsg("");
    const { error } = await supabase.from("partite")
      .update({ stagione_id: nuovaStagioneId ? Number(nuovaStagioneId) : null })
      .eq("id", partitaId);
    setSpostaBusy(null);
    setMsg(error ? "⚠ " + tradErroreDb(error.message) : "✅ Partita spostata di stagione");
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
    setMsg(error ? "⚠ " + tradErroreDb(error.message) : "✅ Stagione aggiornata");
    if (!error) setStagioneModifiche((m) => { const n = { ...m }; delete n[s.id]; return n; });
    carica();
  };

  const impostaAttiva = async (s) => {
    setStagioneBusy(s.id); setMsg("");
    const { error: e1 } = await supabase.from("stagioni")
      .update({ attiva: false }).eq("lega_id", s.lega_id).eq("attiva", true);
    if (e1) { setStagioneBusy(null); setMsg("⚠ " + tradErroreDb(e1.message)); return; }
    const { error: e2 } = await supabase.from("stagioni").update({ attiva: true }).eq("id", s.id);
    setStagioneBusy(null);
    setMsg(e2 ? "⚠ " + tradErroreDb(e2.message) : "✅ Stagione impostata come attiva");
    carica();
  };

  const chiudiStagione = async (s) => {
    setStagioneBusy(s.id); setMsg("");
    const oggi = new Date().toISOString().slice(0, 10);
    const { error } = await supabase.from("stagioni").update({ fine: oggi }).eq("id", s.id);
    setStagioneBusy(null);
    setMsg(error ? "⚠ " + tradErroreDb(error.message) : "✅ Stagione chiusa");
    carica();
  };

  const creaStagione = async () => {
    if (!nuovaStagioneNome || !nuovaStagioneInizio) {
      setMsg("⚠ Compila nome e data di inizio della stagione.");
      return;
    }
    const { error } = await supabase.from("stagioni").insert({
      lega_id: legaId,
      nome: nuovaStagioneNome,
      inizio: nuovaStagioneInizio,
      fine: nuovaStagioneFine || null,
      attiva: false,
    });
    setMsg(error ? "⚠ " + tradErroreDb(error.message) : "✅ Stagione creata");
    if (!error) { setNuovaStagioneNome(""); setNuovaStagioneInizio(""); setNuovaStagioneFine(""); }
    carica();
  };

  // ---------- eliminazione con conferma forte (digitare ELIMINA) ----------
  const apriElimina = (tipo, id, label) => {
    setEliminaTarget({ tipo, id, label });
    setEliminaTesto("");
  };

  // per la lega si digita il nome esatto (non basta "ELIMINA"): è l'operazione
  // più catastrofica del pannello, cascata su tutto senza cestino
  const testoRichiesto = (t) => (t?.tipo === "lega" ? t.label : "ELIMINA");

  const confermaElimina = async () => {
    if (!eliminaTarget || eliminaTesto !== testoRichiesto(eliminaTarget)) return;
    setEliminaBusy(true);

    if (eliminaTarget.tipo === "lega") {
      const { data, error } = await supabase.rpc("elimina_lega", { p_lega_id: eliminaTarget.id });
      setEliminaBusy(false);
      setMsg(error || data !== "ok" ? "⚠ " + (error ? tradErroreDb(error.message) : data) : `✅ Lega "${eliminaTarget.label}" eliminata.`);
      setEliminaTarget(null);
      if (!error && data === "ok") window.location.href = "/";
      return;
    }

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
    setMsg(error ? "⚠ " + tradErroreDb(error.message) : "✅ Eliminazione completata");
    setEliminaTarget(null);
    carica();
  };

  const esportaDati = async () => {
    setMsg("");
    const partiteIds = partite.map((p) => p.id);
    const [{ data: pr }, { data: vo }, { data: dm }] = await Promise.all([
      partiteIds.length ? supabase.from("prestazioni").select("*").in("partita_id", partiteIds) : Promise.resolve({ data: [] }),
      partiteIds.length ? supabase.from("voti_ricevuti").select("*").in("partita_id", partiteIds) : Promise.resolve({ data: [] }),
      partiteIds.length ? supabase.from("dati_manuali").select("*").in("partita_id", partiteIds) : Promise.resolve({ data: [] }),
    ]);
    const pacchetto = {
      esportato_il: new Date().toISOString(),
      lega: legaCorrente,
      membri, stagioni, giocatori, partite,
      prestazioni: pr || [], voti_ricevuti: vo || [], dati_manuali: dm || [],
      premi: premiList,
    };
    const blob = new Blob([JSON.stringify(pacchetto, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${legaCorrente?.slug || "lega"}-dati-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!legaCorrente) return <p className="season">Caricamento…</p>;

  const inAttesa = richieste.filter((r) => r.stato === "in_attesa");
  const gestite = richieste.filter((r) => r.stato !== "in_attesa");

  const partitaLabel = (p) => `${p.data} · ${p.squadra_1} ${p.gol_squadra_1}-${p.gol_squadra_2} ${p.squadra_2}`;
  const partiteCountByStagione = {};
  partite.forEach((p) => { if (p.stagione_id) partiteCountByStagione[p.stagione_id] = (partiteCountByStagione[p.stagione_id] || 0) + 1; });

  return (
    <div>
      {msg && <div className="note" style={{ marginTop: 12 }}>{msg}</div>}

      <SubTabs active={sezioneAdmin} onSelect={setSezioneAdmin} tabs={[
        { key: "partite", label: "Partite" },
        { key: "accessi", label: `Accessi${inAttesa.length ? ` (${inAttesa.length})` : ""}` },
        { key: "struttura", label: "Lega" },
        { key: "premi", label: "Premi" },
      ]} />

      {sezioneAdmin === "partite" && (
        <>
          <h2>Importa da Fubles (link) — più veloce</h2>
          <p className="season">
            Trascina questo link nella barra dei preferiti del browser. Poi, sulla pagina di
            una partita Fubles già disputata (con le pagelle visibili), cliccalo: copia tutto
            in automatico, incolla qui sotto e conferma. Legge solo quello che è già a schermo,
            un giocatore alla volta — nessuna richiesta in più verso Fubles.
          </p>
          <p>
            <a className="mini" href={bookmarkletHref()} onClick={(e) => e.preventDefault()}
              draggable="true">📥 Importa da Fubles</a>
            <span className="season" style={{ marginLeft: 8 }}>← trascina questo nei preferiti</span>
          </p>
          <div className="betaform">
            <label className="flabel">Incolla qui il testo copiato dal bottone</label>
            <textarea rows={4} style={{ width: "100%", fontFamily: "monospace", fontSize: 12 }}
              value={importRapidoText} onChange={(e) => { setImportRapidoText(e.target.value); setImportRapidoPreview(null); }} />
            <button className="mini" style={{ marginTop: 10 }} onClick={analizzaImportRapido} disabled={!importRapidoText}>Analizza</button>
            {importRapidoMsg && <div className="note">{importRapidoMsg}</div>}
            {importRapidoPreview && (
              <>
                <div className="note">
                  {importRapidoPreview.partita.squadra_1} {importRapidoPreview.partita.gol_squadra_1}-{importRapidoPreview.partita.gol_squadra_2} {importRapidoPreview.partita.squadra_2}
                  {" · "}{importRapidoPreview.partita.data}
                  {" · "}{importRapidoPreview.giocatoriNuovi.length} giocatori nuovi (per nome — verifica che non siano già in lista con un nome scritto diverso)
                  {" · "}{importRapidoPreview.prestazioni.length} prestazioni
                  {" · "}{importRapidoPreview.voti.length} voti
                </div>
                {importRapidoPreview.avvisi.map((a, i) => (
                  <div key={i} className="note">⚠ {a}</div>
                ))}
                <button className="mini ok" onClick={confermaImportRapido} disabled={importRapidoBusy}>
                  {importRapidoBusy ? "Importazione…" : "✓ Conferma import"}
                </button>
              </>
            )}
          </div>

          <h2 style={{ marginTop: 32 }}>Importa manualmente (Excel)</h2>
          <p className="season">
            Incolla il testo copiato dai fogli dell&apos;estrazione Fubles (seleziona le celle,
            incluse le intestazioni, e copia/incolla qui). VOTI_RICEVUTI è opzionale.
          </p>
          <div className="betaform">
            <label className="flabel">PARTITE</label>
            <textarea rows={4} style={{ width: "100%", fontFamily: "monospace", fontSize: 12 }}
              value={importPartiteText} onChange={(e) => { setImportPartiteText(e.target.value); setImportPreview(null); }} />
            <label className="flabel">PRESTAZIONI_GIOCATORI</label>
            <textarea rows={4} style={{ width: "100%", fontFamily: "monospace", fontSize: 12 }}
              value={importPrestazioniText} onChange={(e) => { setImportPrestazioniText(e.target.value); setImportPreview(null); }} />
            <label className="flabel">VOTI_RICEVUTI (opzionale)</label>
            <textarea rows={4} style={{ width: "100%", fontFamily: "monospace", fontSize: 12 }}
              value={importVotiText} onChange={(e) => { setImportVotiText(e.target.value); setImportPreview(null); }} />
            <button className="mini" style={{ marginTop: 10 }} onClick={analizzaImport}
              disabled={!importPartiteText || !importPrestazioniText}>Analizza</button>
            {importMsg && <div className="note">{importMsg}</div>}
            {importPreview && (
              <>
                <div className="note">
                  {importPreview.parsed.partite.length - importPreview.nPartiteEsistenti} partite nuove
                  {importPreview.nPartiteEsistenti > 0 && ` (${importPreview.nPartiteEsistenti} già presenti, saltate insieme alle relative prestazioni/voti)`}
                  · {importPreview.nGiocatoriNuovi} giocatori nuovi
                  · {importPreview.nPrestazioni} prestazioni
                  · {importPreview.nVoti} voti
                </div>
                {importPreview.parsed.avvisi.map((a, i) => (
                  <div key={i} className="note">⚠ {a}</div>
                ))}
                <button className="mini ok" onClick={confermaImport} disabled={importBusy}>
                  {importBusy ? "Importazione…" : "✓ Conferma import"}
                </button>
              </>
            )}
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
                        {stagioni.map((s) => (
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
        </>
      )}

      {sezioneAdmin === "accessi" && (
        <>
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
          <div style={{ overflowX: "auto" }}>
            <table>
              <thead><tr><th>Email</th><th>Nome</th><th>Ruolo</th><th>Scheda</th><th>Dal</th><th></th></tr></thead>
              <tbody>
                {membri.map((m) => (
                  <tr key={m.email}>
                    <td>{m.email}</td>
                    <td className="pname">{m.nome || "—"}</td>
                    <td>
                      {isAdmin && m.ruolo !== "admin" ? (
                        <select value={m.ruolo} onChange={(e) => cambiaRuolo(m.email, e.target.value)}>
                          <option value="membro">membro</option>
                          <option value="coorganizzatore">🛡 coorganizzatore</option>
                        </select>
                      ) : m.ruolo === "admin" ? "👑 admin" : m.ruolo === "coorganizzatore" ? "🛡 coorganizzatore" : "membro"}
                    </td>
                    <td>{m.giocatore_id ? `#${m.giocatore_id}` : "—"}</td>
                    <td>{new Date(m.aggiunto_il).toLocaleDateString("it-IT")}</td>
                    <td>{(isAdmin ? m.ruolo !== "admin" : m.ruolo === "membro") && (
                      <button className="mini no" onClick={() => revoca(m.email)}>Revoca</button>
                    )}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {gestite.length > 0 && (
            <>
              <h2>Storico richieste</h2>
              <div style={{ overflowX: "auto" }}>
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
              </div>
            </>
          )}
        </>
      )}

      {sezioneAdmin === "struttura" && (
        <>
          <h2>{legaCorrente.nome}</h2>
          <div className="menulist">
            <div className="menu-item" style={{ cursor: "default" }}>
              <div>
                <b>Slug</b>
                <div style={{ fontSize: 12, opacity: .7, marginTop: 2 }}>{legaCorrente.slug}</div>
              </div>
            </div>
          </div>
          {isAdmin ? (
            <div className="betaform">
              <h3>Dove e quando si gioca</h3>
              <input placeholder="Struttura sportiva — es. Centro Sportivo Bettinelli" value={infoStruttura}
                onChange={(e) => setInfoStruttura(e.target.value)} />
              <input placeholder="Orario — es. Lunedì · 21:30" value={infoOrario}
                onChange={(e) => setInfoOrario(e.target.value)} />
              <button className="mini ok" style={{ marginTop: 10 }} onClick={salvaInfoLega} disabled={infoBusy}>
                {infoBusy ? "Salvataggio…" : "💾 Salva"}
              </button>
            </div>
          ) : (legaCorrente.struttura || legaCorrente.orario) && (
            <p className="season">{[legaCorrente.struttura, legaCorrente.orario].filter(Boolean).join(" · ")}</p>
          )}

          <p className="season" style={{ marginTop: 20 }}>Una lega pubblica compare in /leghe: chiunque può trovarla e chiedere di entrare, senza bisogno di un invito diretto.</p>
          {isAdmin ? (
            <button className={`mini ${legaCorrente.pubblica ? "ok" : ""}`} onClick={() => togglePubblica(!legaCorrente.pubblica)}>
              {legaCorrente.pubblica ? "🌐 Pubblica — clicca per rendere privata" : "🔒 Privata — clicca per rendere pubblica"}
            </button>
          ) : (
            <span className="season">{legaCorrente.pubblica ? "🌐 Pubblica" : "🔒 Privata"} · solo l&apos;admin può cambiarlo</span>
          )}

          <h2 style={{ marginTop: 32 }}>Stagioni ({stagioni.length})</h2>
          <div style={{ overflowX: "auto" }}>
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
                        {isAdmin && (
                          <button className="mini no" disabled={nPartite > 0}
                            title={nPartite > 0 ? "Sposta o elimina prima le partite collegate" : ""}
                            onClick={() => apriElimina("stagione", s.id, s.nome)}>Elimina</button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="betaform">
            <h3>Crea nuova stagione (o torneo)</h3>
            <input placeholder="Nome — es. 2027/28, oppure Christmas Cup" value={nuovaStagioneNome} onChange={(e) => setNuovaStagioneNome(e.target.value)} />
            <label className="flabel">Data inizio</label>
            <input type="date" value={nuovaStagioneInizio} onChange={(e) => setNuovaStagioneInizio(e.target.value)} />
            <label className="flabel">Data fine (opzionale)</label>
            <input type="date" value={nuovaStagioneFine} onChange={(e) => setNuovaStagioneFine(e.target.value)} />
            <button className="mini ok" style={{ marginTop: 10 }} onClick={creaStagione}
              disabled={!nuovaStagioneNome || !nuovaStagioneInizio}>+ Crea stagione</button>
          </div>

          <h2 style={{ marginTop: 32 }}>I tuoi dati</h2>
          <p className="season">
            Puoi scaricare in qualsiasi momento tutti i dati di questa lega{isAdmin ? ", o eliminarla del tutto — cancella anche i dati di membri, partite, voti e premi collegati." : "."}
          </p>
          <button className="mini" onClick={esportaDati}>⬇ Esporta i dati della lega</button>{" "}
          {isAdmin && (
            <button className="mini no" onClick={() => apriElimina("lega", legaId, legaCorrente.nome)}>
              Elimina questa lega
            </button>
          )}
        </>
      )}

      {sezioneAdmin === "premi" && (
        <>
          <h2>Premi</h2>
          <div className="betaform">
            <h3>Assegna un premio</h3>
            <select value={premioGiocatore} onChange={(e) => setPremioGiocatore(e.target.value)}>
              <option value="">— Giocatore —</option>
              {giocatori.map((g) => <option key={g.id} value={g.id}>{g.nickname || g.nome}</option>)}
            </select>
            <input placeholder='Tipo — es. "miglior_portiere", "gol_del_mese"' value={premioTipo} onChange={(e) => setPremioTipo(e.target.value)} />
            <label className="flabel">Periodo</label>
            <span className="toggle">
              <button type="button" className={premioPeriodo === "partita" ? "on" : ""} onClick={() => setPremioPeriodo("partita")}>Partita</button>
              <button type="button" className={premioPeriodo === "mese" ? "on" : ""} onClick={() => setPremioPeriodo("mese")}>Mese</button>
              <button type="button" className={premioPeriodo === "stagione" ? "on" : ""} onClick={() => setPremioPeriodo("stagione")}>Stagione</button>
            </span>
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
            <div style={{ overflowX: "auto" }}>
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
            </div>
          )}
        </>
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
            ) : eliminaTarget.tipo === "lega" ? (
              <p>
                Stai per eliminare <b>tutta la lega {eliminaTarget.label}</b>: giocatori, membri,
                partite, voti, premi e stagioni collegati. Se vuoi tenerne una copia, esporta i
                dati prima di confermare. L&apos;operazione non è reversibile — nessun cestino,
                nessun ripristino.
              </p>
            ) : (
              <p>
                Stai per eliminare la stagione <b>{eliminaTarget.label}</b>. Non ha partite
                collegate, quindi non verrà eliminato altro. L&apos;operazione non è reversibile.
              </p>
            )}
            <p className="season">
              {eliminaTarget.tipo === "lega"
                ? <>Digita il nome esatto della lega, <b>{eliminaTarget.label}</b>, per confermare</>
                : <>Digita <b>ELIMINA</b> per confermare</>}
            </p>
            <input type="text" value={eliminaTesto} onChange={(e) => setEliminaTesto(e.target.value)}
              placeholder={testoRichiesto(eliminaTarget)} autoFocus />
            <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
              <button className="mini no" disabled={eliminaTesto !== testoRichiesto(eliminaTarget) || eliminaBusy} onClick={confermaElimina}>
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
