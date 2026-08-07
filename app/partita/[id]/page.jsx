"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";

// TODO v0.9: estrarre in lib/engine.js insieme alle funzioni analoghe di app/page.jsx
const MESI = ["Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago", "Set", "Ott", "Nov", "Dic"];
const fmtData = (iso) => {
  const d = new Date(iso + "T00:00:00");
  return `${d.getDate()} ${MESI[d.getMonth()]} ${d.getFullYear()}`;
};
const iniziali = (nome) => (nome || "?").split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();

function RigaFormazione({ p }) {
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
        {p.motm && <span className="formmvp" title="MVP">⭐</span>}
        {p.gol > 0 && <span className="formgol" title="Gol">⚽ {p.gol}</span>}
        <span className="formvoto">{p.voto != null ? p.voto.toFixed(1) : "—"}</span>
      </div>
    </div>
  );
}

export default function Partita() {
  const params = useParams();
  const id = Number(params.id);

  // verifica | no-login | no-consenso | no-membro | non-trovata | errore | ok
  const [stato, setStato] = useState("verifica");
  const [partita, setPartita] = useState(null);
  const [righe, setRighe] = useState([]);
  const [errore, setErrore] = useState("");

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setStato("no-login"); return; }
      const mail = (session.user?.email || "").toLowerCase();

      const { data: c } = await supabase.from("consensi").select("email").eq("email", mail).maybeSingle();
      if (!c) { setStato("no-consenso"); return; }

      const { data: me } = await supabase.from("membri_autorizzati").select("email").eq("email", mail).maybeSingle();
      if (!me) { setStato("no-membro"); return; }

      const { data: p, error: pErr } = await supabase.from("partite").select("*").eq("id", id).maybeSingle();
      if (pErr) { setErrore(pErr.message); setStato("errore"); return; }
      if (!p) { setStato("non-trovata"); return; }
      setPartita(p);

      const { data: pr, error: prErr } = await supabase.from("prestazioni").select("*").eq("partita_id", id);
      if (prErr) { setErrore(prErr.message); setStato("errore"); return; }

      const ids = [...new Set((pr || []).map((r) => r.giocatore_id))];
      let giocMap = {};
      if (ids.length) {
        const { data: gi, error: giErr } = await supabase.from("giocatori").select("*").in("id", ids);
        if (giErr) { setErrore(giErr.message); setStato("errore"); return; }
        (gi || []).forEach((g) => { giocMap[g.id] = g; });
      }

      setRighe((pr || []).map((r) => {
        const g = giocMap[r.giocatore_id];
        return {
          ...r,
          nome: g?.nome || "Giocatore",
          nickname: g?.nickname,
          foto_url: g?.foto_url,
          ruolo: r.ruolo || g?.ruolo_prevalente || "—",
          voto: r.voto == null ? null : Number(r.voto),
        };
      }));
      setStato("ok");
    })();
  }, [id]);

  if (stato === "verifica") return <div className="centered">Caricamento…</div>;
  if (stato === "no-login" || stato === "no-consenso" || stato === "no-membro") {
    return <div className="centered">Accesso riservato ai membri della lega. <a className="plink" href="/">← Vai al login</a></div>;
  }
  if (stato === "errore") return <div className="centered">Errore dati: {errore}</div>;
  if (stato === "non-trovata") return <div className="centered">Partita non trovata. <a className="plink" href="/">← Torna a Scarsi League</a></div>;

  const squadre = [partita.squadra_1, partita.squadra_2];
  const gol = [partita.gol_squadra_1, partita.gol_squadra_2];
  const forza = [partita.forza_squadra_1, partita.forza_squadra_2];

  const perSquadra = (nome) =>
    righe.filter((r) => r.squadra === nome).sort((a, b) => (b.voto ?? -1) - (a.voto ?? -1));

  const mvp = righe.find((r) => r.motm);
  const migliorVoto = [...righe].filter((r) => r.voto != null).sort((a, b) => b.voto - a.voto)[0];

  const mediaSquadra = (nome) => {
    const voti = righe.filter((r) => r.squadra === nome && r.voto != null).map((r) => r.voto);
    return voti.length ? voti.reduce((a, b) => a + b, 0) / voti.length : null;
  };

  const totGol = gol[0] + gol[1];
  const golAttribuiti = righe.reduce((a, r) => a + (r.gol || 0), 0);
  const diffReti = Math.abs(gol[0] - gol[1]);
  const media1 = mediaSquadra(squadre[0]);
  const media2 = mediaSquadra(squadre[1]);

  return (
    <div className="wrap">
      <div className="brand">
        <h1>Scarsi <em>League</em></h1>
        <span className="season"><a className="plink" href="/">← Torna alla lega</a></span>
      </div>

      <section className="hero" style={{ marginTop: 20 }}>
        <span className="lbl">{fmtData(partita.data)}{partita.struttura ? ` · ${partita.struttura}` : ""}</span>
        <div className="team"><b>{squadre[0]}</b>{forza[0] != null && <span>forza {forza[0]}</span>}</div>
        <div className="score">{gol[0]}<span>–</span>{gol[1]}</div>
        <div className="team"><b>{squadre[1]}</b>{forza[1] != null && <span>forza {forza[1]}</span>}</div>
        {mvp && <div className="mvpline">⭐ MVP <b>{mvp.nickname || mvp.nome}</b> · voto {mvp.voto ?? "—"}</div>}
      </section>

      {partita.fubles_url && (
        <div className="note" style={{ textAlign: "center" }}>
          <a className="plink" href={partita.fubles_url} target="_blank" rel="noreferrer">Vedi su Fubles ↗</a>
        </div>
      )}

      <div className="strip">
        <div className="stat"><b>{media1 != null ? media1.toFixed(2) : "—"}</b><span>Media {squadre[0]}</span></div>
        <div className="stat"><b>{media2 != null ? media2.toFixed(2) : "—"}</b><span>Media {squadre[1]}</span></div>
        <div className="stat wide"><b>{migliorVoto ? (migliorVoto.nickname || migliorVoto.nome) : "—"}</b><span>Migliore in campo</span></div>
        <div className="stat"><b>{totGol}</b><span>Gol totali</span></div>
        <div className="stat"><b>{diffReti}</b><span>Differenza reti</span></div>
      </div>
      {golAttribuiti < totGol && (
        <div className="note">⚠ Marcatori attribuiti su Fubles: {golAttribuiti} gol su {totGol} totali — parziali.</div>
      )}

      <h2>Formazioni</h2>
      <div className="formations">
        {squadre.map((nome) => (
          <div key={nome} className="formteam">
            <h3>{nome}</h3>
            {perSquadra(nome).length === 0
              ? <p className="season">Nessun dato disponibile</p>
              : perSquadra(nome).map((r) => <RigaFormazione key={r.giocatore_id} p={r} />)}
          </div>
        ))}
      </div>
    </div>
  );
}
