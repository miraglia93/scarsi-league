"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { assemble, buildStats, tradErroreDb, applicaNomiRegistrati, applicaGolManuali, applicaVotoArricchito } from "../../lib/engine";
import AppNav from "../../components/AppNav";
import SubTabs from "../../components/SubTabs";

export default function HallOfFame() {
  // verifica | no-login | no-consenso | no-membro | errore | ok
  const [stato, setStato] = useState("verifica");
  const [leghe, setLeghe] = useState([]);
  const [legaId, setLegaId] = useState(null);
  const [raw, setRaw] = useState(null);
  const [errore, setErrore] = useState("");
  const [nomiRegistrati, setNomiRegistrati] = useState({});

  useEffect(() => {
    if (legaId == null) { setNomiRegistrati({}); return; }
    supabase.rpc("nomi_registrati", { p_lega_id: legaId }).then(({ data: righe }) => {
      const m = {};
      (righe || []).forEach((r) => { m[r.giocatore_id] = r.nome_completo; });
      setNomiRegistrati(m);
    });
  }, [legaId]);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setStato("no-login"); return; }
      const mail = (session.user?.email || "").toLowerCase();

      const { data: c } = await supabase.from("consensi").select("email").eq("email", mail).maybeSingle();
      if (!c) { setStato("no-consenso"); return; }

      const { data: me } = await supabase.from("membri_autorizzati").select("email").eq("email", mail);
      if (!me || !me.length) { setStato("no-membro"); return; }

      const [le, st, pa, gi, pr, vo, dm, vc] = await Promise.all([
        supabase.from("leghe").select("*").order("id"),
        supabase.from("stagioni").select("*"),
        supabase.from("partite").select("*"),
        supabase.from("giocatori").select("*"),
        supabase.from("prestazioni").select("*"),
        supabase.from("voti_ricevuti").select("*"),
        supabase.from("dati_manuali").select("*"),
        supabase.from("voti_capitano").select("*"),
      ]);
      const err = le.error || st.error || pa.error || gi.error || pr.error || vo.error || dm.error;
      if (err) { setErrore(tradErroreDb(err.message)); setStato("errore"); return; }

      setLeghe(le.data || []);
      setLegaId((le.data || [])[0]?.id ?? null);
      setRaw({ st: st.data || [], pa: pa.data || [], gi: gi.data || [], pr: pr.data || [], vo: vo.data || [], dm: dm.data || [], vc: vc.data || [] });
      setStato("ok");
    })();
  }, []);

  if (stato === "verifica") return <div className="centered">Caricamento…</div>;
  if (stato === "no-login" || stato === "no-consenso" || stato === "no-membro") {
    return <div className="centered">Accesso riservato ai membri della lega. <a className="plink" href="/">← Vai al login</a></div>;
  }
  if (stato === "errore") return (
    <div className="centered">
      Non siamo riusciti a caricare la Hall of Fame.<br />
      <span style={{ fontSize: 12, opacity: .7 }}>{errore}</span><br />
      <a className="plink" href="/hall-of-fame">Riprova</a>
    </div>
  );

  const stagioniConcluse = raw.st
    .filter((s) => s.lega_id === legaId && !s.attiva)
    .sort((a, b) => (a.inizio < b.inizio ? 1 : -1));
  const giocLega = applicaNomiRegistrati(raw.gi.filter((g) => g.lega_id === legaId), nomiRegistrati);

  const cards = stagioniConcluse.map((s) => {
    const paStagione = raw.pa.filter((p) => p.lega_id === legaId && p.stagione_id === s.id);
    if (!paStagione.length) return { stagione: s, vuota: true };

    const paIds = new Set(paStagione.map((p) => p.id));
    const pr = raw.pr.filter((p) => paIds.has(p.partita_id));
    const vo = raw.vo.filter((v) => paIds.has(v.partita_id));
    const dm = raw.dm.filter((d) => paIds.has(d.partita_id));
    const vc = raw.vc.filter((v) => paIds.has(v.partita_id));
    const prArricchite = applicaVotoArricchito(applicaGolManuali(pr, dm), vo, vc, paStagione, raw.st);
    const { P, matches } = assemble(paStagione, giocLega, prArricchite, vo, vc);
    const S = buildStats(P, matches);
    const players = Object.values(S).filter((p) => p.presenze > 0);
    if (!players.length) return { stagione: s, vuota: true };

    const totGol = matches.reduce((a, m) => a + Object.values(m.score).reduce((x, y) => x + y, 0), 0);
    const regulars = players.filter((p) => p.presenze >= 2);
    const classifica = [...regulars].sort((a, b) => b.punti - a.punti || b.mediaVoto - a.mediaVoto)[0];
    const capocannoniere = [...players].sort((a, b) => b.gol - a.gol)[0];
    const topVoto = [...regulars].sort((a, b) => b.mediaVoto - a.mediaVoto)[0];
    const topMvp = [...players].sort((a, b) => b.mvp - a.mvp || b.mediaVoto - a.mediaVoto)[0];

    return {
      stagione: s, vuota: false, nPartite: matches.length, totGol,
      classifica, capocannoniere,
      topVoto: topVoto && topVoto.mediaVoto > 0 ? topVoto : null,
      topMvp: topMvp && topMvp.mvp > 0 ? topMvp : null,
    };
  });

  return (
    <>
      <AppNav active="lega" />
      <div className="wrap navpad">
      <div className="brand">
        <h1>Hall of <em>Fame</em></h1>
        <span className="season"><a className="plink" href="/">← Torna a Scarsi League</a></span>
      </div>
      <SubTabs active="hof" tabs={[
        { key: "panoramica", label: "Panoramica", href: "/?sezione=lega" },
        { key: "totw", label: "Team of the Week", href: "/?sezione=lega&sub=totw" },
        { key: "hof", label: "Hall of Fame", href: "/hall-of-fame" },
      ]} />
      {leghe.length > 1 && (
        <select className="legasel" style={{ marginTop: 16 }} value={legaId ?? ""} onChange={(e) => setLegaId(Number(e.target.value))}>
          {leghe.map((l) => <option key={l.id} value={l.id}>{l.nome}</option>)}
        </select>
      )}

      {cards.length === 0 ? (
        <p className="centered">Nessuna stagione conclusa ancora — la prima Hall of Fame arriverà a fine stagione 🏆</p>
      ) : (
        <div className="grid2" style={{ marginTop: 24 }}>
          {cards.map(({ stagione, vuota, nPartite, totGol, classifica, capocannoniere, topVoto, topMvp }) => (
            <div key={stagione.id} className="hofcard">
              <h3>{stagione.nome}</h3>
              {vuota ? (
                <p className="season">Nessuna partita disputata in questa stagione</p>
              ) : (
                <>
                  <div className="hofrow"><span>🏆 Classifica</span><b>{classifica ? classifica.nome : "—"}</b></div>
                  <div className="hofrow"><span>⚽ Capocannoniere</span><b>{capocannoniere ? `${capocannoniere.nome} (${capocannoniere.gol})` : "—"}</b></div>
                  <div className="hofrow"><span>📈 Miglior media</span><b>{topVoto ? `${topVoto.nome} (${topVoto.mediaVoto.toFixed(2)})` : "—"}</b></div>
                  <div className="hofrow"><span>⭐ Re degli MVP</span><b>{topMvp ? `${topMvp.nome} (${topMvp.mvp})` : "—"}</b></div>
                  <div className="hofmeta">{nPartite} partite · {totGol} gol totali</div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
      </div>
    </>
  );
}
