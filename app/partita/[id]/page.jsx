"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";
import { fmtData, iniziali } from "../../../lib/engine";

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

function buildReportText({ partita, squadre, gol, righe, mvp, media1, media2, golAttribuiti, totGol, leader }) {
  const righeStruttura = partita.struttura ? ` · ${partita.struttura}` : "";
  const lines = [`⚽ SCARSI LEAGUE — Calci8Lunedì ${fmtData(partita.data, { year: true })}${righeStruttura}`];
  lines.push(`${squadre[0]} ${gol[0]} – ${gol[1]} ${squadre[1]}`);
  if (mvp) lines.push(`⭐ MVP: ${mvp.nickname || mvp.nome} (voto ${mvp.voto})`);

  const marcatori = righe.filter((r) => r.gol > 0).sort((a, b) => b.gol - a.gol)
    .map((r) => `${r.nickname || r.nome} x${r.gol}`).join(", ");
  const parziale = golAttribuiti < totGol ? (marcatori ? ", e altri gol non attribuiti su Fubles" : "") : "";
  if (marcatori) lines.push(`⚽ Marcatori: ${marcatori}${parziale}`);
  else if (totGol > 0) lines.push(`⚽ Marcatori: nessuno attribuito su Fubles`);

  lines.push(`📊 Media voto: ${squadre[0]} ${media1 != null ? media1.toFixed(2) : "—"} · ${squadre[1]} ${media2 != null ? media2.toFixed(2) : "—"}`);
  if (leader) lines.push(`📈 Classifica: ${leader.nome} guida con ${leader.punti} punti`);
  lines.push(`👉 scarsileague.it`);
  return lines.join("\n");
}

function ReportButton({ testo }) {
  const [stato, setStato] = useState("idle"); // idle | copiato | errore

  const copia = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(testo);
      } else {
        const ta = document.createElement("textarea");
        ta.value = testo;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      setStato("copiato");
      setTimeout(() => setStato("idle"), 2000);
    } catch {
      setStato("errore");
      setTimeout(() => setStato("idle"), 3000);
    }
  };

  return (
    <button className="mini ok" onClick={copia}>
      {stato === "copiato" ? "Copiato ✅" : stato === "errore" ? "⚠ Copia manualmente" : "📋 Copia report WhatsApp"}
    </button>
  );
}

export default function Partita() {
  const params = useParams();
  const id = Number(params.id);

  // verifica | no-login | no-consenso | no-membro | non-trovata | errore | ok
  const [stato, setStato] = useState("verifica");
  const [partita, setPartita] = useState(null);
  const [righe, setRighe] = useState([]);
  const [leader, setLeader] = useState(null);
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

      // chi guida la classifica generale della lega (regulars, presenze >= 2)
      const { data: partiteLega } = await supabase.from("partite").select("id").eq("lega_id", p.lega_id);
      const idsLega = (partiteLega || []).map((m) => m.id);
      if (idsLega.length) {
        const { data: prLega } = await supabase.from("prestazioni")
          .select("giocatore_id, voto, esito").in("partita_id", idsLega);
        const agg = {};
        (prLega || []).forEach((r) => {
          const s = (agg[r.giocatore_id] = agg[r.giocatore_id] || { presenze: 0, punti: 0, voti: [] });
          s.presenze++;
          if (r.esito === "Vittoria") s.punti += 3;
          else if (r.esito === "Pareggio") s.punti += 1;
          if (r.voto != null) s.voti.push(Number(r.voto));
        });
        const top = Object.entries(agg)
          .map(([gid, s]) => ({ gid: Number(gid), ...s, media: s.voti.length ? s.voti.reduce((a, b) => a + b, 0) / s.voti.length : 0 }))
          .filter((s) => s.presenze >= 2)
          .sort((a, b) => b.punti - a.punti || b.media - a.media)[0];
        if (top) {
          const { data: gTop } = await supabase.from("giocatori").select("nome, nickname").eq("id", top.gid).maybeSingle();
          if (gTop) setLeader({ nome: gTop.nickname || gTop.nome, punti: top.punti });
        }
      }

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

  const reportText = buildReportText({ partita, squadre, gol, righe, mvp, media1, media2, golAttribuiti, totGol, leader });

  return (
    <div className="wrap">
      <div className="brand">
        <h1>Scarsi <em>League</em></h1>
        <span className="season"><a className="plink" href="/">← Torna alla lega</a></span>
      </div>

      <section className="hero" style={{ marginTop: 20 }}>
        <span className="lbl">{fmtData(partita.data, { year: true })}{partita.struttura ? ` · ${partita.struttura}` : ""}</span>
        <div className="team"><b>{squadre[0]}</b>{forza[0] != null && <span>forza {forza[0]}</span>}</div>
        <div className="score">{gol[0]}<span>–</span>{gol[1]}</div>
        <div className="team"><b>{squadre[1]}</b>{forza[1] != null && <span>forza {forza[1]}</span>}</div>
        {mvp && <div className="mvpline">⭐ MVP <b>{mvp.nickname || mvp.nome}</b> · voto {mvp.voto ?? "—"}</div>}
      </section>

      <div className="reportbar">
        <ReportButton testo={reportText} />
        {partita.fubles_url && (
          <a className="plink" href={partita.fubles_url} target="_blank" rel="noreferrer">Vedi su Fubles ↗</a>
        )}
      </div>

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
