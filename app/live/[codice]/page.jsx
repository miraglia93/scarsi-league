"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";
import { fmtData, iniziali, calcolaPunteggioLive } from "../../../lib/engine";

// pagina pubblica: nessun login, nessun controllo consensi/membri — la
// sola porta d'accesso è il codice_live nell'URL, generato dal gestore
// quando attiva la condivisione. RLS `to anon` (v30) scoped sempre a
// questa singola partita, mai all'intera lega.
function RigaFormazionePubblica({ p }) {
  return (
    <div className="formrow">
      {p.foto_url
        ? <img className="formfoto" src={p.foto_url} alt={p.nome} />
        : <div className="formavatar">{iniziali(p.nome)}</div>}
      <div className="forminfo">
        <span className="formname" title={p.nome}>{p.nickname || p.nome}</span>
        <span className="formruolo">{p.ruolo}</span>
      </div>
      <div className="formvals">
        {p.gol > 0 && <span className="formgol" title="Gol">⚽ {p.gol}</span>}
        {p.assist > 0 && <span className="formgol" title="Assist">🅰️ {p.assist}</span>}
        {p.clean_sheet && <span className="formgol" title="Clean sheet">🧤</span>}
        {p.cartellini > 0 && <span className="formgol" title="Cartellini">🟨{p.cartellini > 1 ? `×${p.cartellini}` : ""}</span>}
        {p.autogol > 0 && <span className="formgol" title="Autogol">🙈{p.autogol > 1 ? `×${p.autogol}` : ""}</span>}
      </div>
    </div>
  );
}

export default function LivePubblico() {
  const params = useParams();
  const codice = params.codice;

  const [stato, setStato] = useState("verifica"); // verifica | non-trovata | ok
  const [partita, setPartita] = useState(null);
  const [prestazioni, setPrestazioni] = useState([]);
  const [datiManuali, setDatiManuali] = useState([]);
  const [giocatoriMap, setGiocatoriMap] = useState({});

  const carica = useCallback(async () => {
    const { data: p } = await supabase.from("partite").select("*")
      .eq("codice_live", codice).eq("condivisione_pubblica", true).maybeSingle();
    if (!p) { setStato("non-trovata"); return; }
    setPartita(p);

    const [{ data: pr }, { data: dm }] = await Promise.all([
      supabase.from("prestazioni").select("*").eq("partita_id", p.id),
      supabase.from("dati_manuali").select("*").eq("partita_id", p.id),
    ]);
    setPrestazioni(pr || []);
    setDatiManuali(dm || []);

    const ids = [...new Set((pr || []).map((r) => r.giocatore_id))];
    if (ids.length) {
      const { data: gi } = await supabase.from("giocatori").select("id, nome, nickname, foto_url").in("id", ids);
      const map = {};
      (gi || []).forEach((g) => { map[g.id] = g; });
      setGiocatoriMap(map);
    }
    setStato("ok");
  }, [codice]);

  useEffect(() => { carica(); }, [carica]);

  useEffect(() => {
    if (!partita) return;
    const channel = supabase.channel(`live-pubblico-${partita.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "prestazioni", filter: `partita_id=eq.${partita.id}` }, carica)
      .on("postgres_changes", { event: "*", schema: "public", table: "dati_manuali", filter: `partita_id=eq.${partita.id}` }, carica)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [partita?.id, carica]);

  if (stato === "verifica") return <div className="centered">Caricamento…</div>;
  if (stato === "non-trovata") {
    return <div className="centered">Diretta non trovata — il link potrebbe non essere più attivo.</div>;
  }

  const squadre = [partita.squadra_1, partita.squadra_2];
  const forza = [partita.forza_squadra_1, partita.forza_squadra_2];
  const punteggio = partita.stato_live
    ? calcolaPunteggioLive(prestazioni, datiManuali)
    : { [squadre[0]]: partita.gol_squadra_1, [squadre[1]]: partita.gol_squadra_2 };
  const gol = [punteggio[squadre[0]] || 0, punteggio[squadre[1]] || 0];

  const dmMap = {};
  datiManuali.forEach((d) => { dmMap[d.giocatore_id] = d; });
  const righe = prestazioni.map((r) => {
    const g = giocatoriMap[r.giocatore_id];
    const d = dmMap[r.giocatore_id];
    return {
      ...r,
      nome: g?.nome || "Giocatore",
      nickname: g?.nickname,
      foto_url: g?.foto_url,
      ruolo: r.ruolo || "—",
      gol: d?.gol_manuale != null ? d.gol_manuale : r.gol,
      assist: d?.assist || 0,
      clean_sheet: !!d?.clean_sheet,
      cartellini: d?.cartellini || 0,
      autogol: d?.autogol || 0,
    };
  });
  const perSquadra = (nome) => righe.filter((r) => r.squadra === nome);

  return (
    <div className="wrap">
      <div className="brand">
        <h1>Scarsi <em>League</em></h1>
      </div>

      <section className="hero" style={{ marginTop: 20 }}>
        {partita.stato_live === "in_corso" && <div className="note" style={{ color: "#E05C4B", fontWeight: 700 }}>🔴 IN DIRETTA</div>}
        {partita.stato_live === "conclusa" && <div className="note" style={{ color: "#5CBF7A", fontWeight: 700 }}>✅ Partita conclusa</div>}
        {partita.stato_live === "programmata" && <div className="note">⏳ Non ancora iniziata</div>}
        <span className="lbl">{fmtData(partita.data, { year: true })}{partita.struttura ? ` · ${partita.struttura}` : ""}</span>
        <div className="team"><b>{squadre[0]}</b>{forza[0] != null && <span>forza {forza[0]}</span>}</div>
        <div className="score">{gol[0]}<span>–</span>{gol[1]}</div>
        <div className="team"><b>{squadre[1]}</b>{forza[1] != null && <span>forza {forza[1]}</span>}</div>
      </section>

      <h2>Formazioni</h2>
      <div className="formations">
        {squadre.map((nome) => (
          <div key={nome} className="formteam">
            <h3>{nome}</h3>
            {perSquadra(nome).length === 0
              ? <p className="season">Formazione non ancora disponibile</p>
              : perSquadra(nome).map((r) => <RigaFormazionePubblica key={r.giocatore_id} p={r} />)}
          </div>
        ))}
      </div>

      <p className="season" style={{ textAlign: "center", marginTop: 24 }}>👉 scarsileague.it</p>
    </div>
  );
}
