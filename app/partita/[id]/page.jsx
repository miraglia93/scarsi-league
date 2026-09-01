"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";
import { fmtData, iniziali, tradErroreDb, applicaNomiRegistrati, applicaVotoArricchito, calcolaPunteggioLive } from "../../../lib/engine";
import AppNav from "../../../components/AppNav";
import CopyButton from "../../../components/CopyButton";
import RecapImageButton from "../../../components/RecapImageButton";
import SubTabs from "../../../components/SubTabs";
import CommentiPartita from "../../../components/CommentiPartita";
import CapitanoSquadra from "../../../components/CapitanoSquadra";
import ProposteIncrociate from "../../../components/ProposteIncrociate";
import VotiCapitano from "../../../components/VotiCapitano";
import LiveCronista from "../../../components/LiveCronista";

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
        {p.assist > 0 && <span className="formgol" title="Assist">🅰️ {p.assist}</span>}
        {p.clean_sheet && <span className="formgol" title="Clean sheet">🧤</span>}
        {p.cartellini > 0 && <span className="formgol" title="Cartellini">🟨{p.cartellini > 1 ? `×${p.cartellini}` : ""}</span>}
        {p.autogol > 0 && <span className="formgol" title="Autogol">🙈{p.autogol > 1 ? `×${p.autogol}` : ""}</span>}
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
  return <CopyButton text={testo} label="📋 Copia report WhatsApp" />;
}

export default function Partita() {
  const params = useParams();
  const id = Number(params.id);

  // verifica | no-login | no-consenso | no-membro | non-trovata | errore | ok
  const [stato, setStato] = useState("verifica");
  const [partita, setPartita] = useState(null);
  const [righe, setRighe] = useState([]);
  const [leader, setLeader] = useState(null);
  const [premiPartita, setPremiPartita] = useState([]);
  const [errore, setErrore] = useState("");
  const [tab, setTab] = useState("formazioni");
  const [mioEmail, setMioEmail] = useState("");
  const [sonoGestore, setSonoGestore] = useState(false);
  const [mieSquadreCapitano, setMieSquadreCapitano] = useState([]);
  const [haVotoCapitano, setHaVotoCapitano] = useState(false);
  const [giocatoriMap, setGiocatoriMap] = useState({});
  const [sonoCronista, setSonoCronista] = useState(false);
  const [prestazioniRaw, setPrestazioniRaw] = useState([]);
  const [datiManualiRaw, setDatiManualiRaw] = useState([]);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setStato("no-login"); return; }
      const mail = (session.user?.email || "").toLowerCase();

      const { data: c } = await supabase.from("consensi").select("email").eq("email", mail).maybeSingle();
      if (!c) { setStato("no-consenso"); return; }

      const { data: me } = await supabase.from("membri_autorizzati").select("email, ruolo").eq("email", mail);
      if (!me || !me.length) { setStato("no-membro"); return; }
      setMioEmail(mail);
      setSonoGestore(me[0].ruolo === "admin" || me[0].ruolo === "coorganizzatore");

      const { data: p, error: pErr } = await supabase.from("partite").select("*").eq("id", id).maybeSingle();
      if (pErr) { setErrore(tradErroreDb(pErr.message)); setStato("errore"); return; }
      if (!p) { setStato("non-trovata"); return; }
      setPartita(p);

      const { data: nomiReg } = await supabase.rpc("nomi_registrati", { p_lega_id: p.lega_id });
      const mappaNomi = {};
      (nomiReg || []).forEach((r) => { mappaNomi[r.giocatore_id] = r.nome_completo; });

      const { data: pr, error: prErr } = await supabase.from("prestazioni").select("*").eq("partita_id", id);
      if (prErr) { setErrore(tradErroreDb(prErr.message)); setStato("errore"); return; }

      const { data: dm } = await supabase.from("dati_manuali").select("*").eq("partita_id", id);
      const dmMap = {};
      (dm || []).forEach((d) => { dmMap[d.giocatore_id] = d; });
      setPrestazioniRaw(pr || []);
      setDatiManualiRaw(dm || []);

      if (p.stato_live) {
        const { data: cr } = await supabase.from("cronisti_partita").select("email").eq("partita_id", id).eq("email", mail);
        setSonoCronista(!!(cr || []).length);
      }

      const { data: pre } = await supabase.from("premi").select("*").eq("partita_id", id);
      setPremiPartita(pre || []);

      const ids = [...new Set((pr || []).map((r) => r.giocatore_id))];
      let giocMap = {};
      if (ids.length) {
        const { data: gi, error: giErr } = await supabase.from("giocatori").select("*").in("id", ids);
        if (giErr) { setErrore(tradErroreDb(giErr.message)); setStato("errore"); return; }
        applicaNomiRegistrati(gi || [], mappaNomi).forEach((g) => { giocMap[g.id] = g; });
      }
      setGiocatoriMap(giocMap);

      const { data: cap } = await supabase.from("capitani_partita").select("squadra").eq("partita_id", id).eq("email", mail);
      setMieSquadreCapitano((cap || []).map((c) => c.squadra));

      const [{ data: vr }, { data: vc }, { data: stag }] = await Promise.all([
        supabase.from("voti_ricevuti").select("*").eq("partita_id", id),
        supabase.from("voti_capitano").select("*").eq("partita_id", id),
        p.stagione_id ? supabase.from("stagioni").select("id, peso_voto_capitano").eq("id", p.stagione_id) : Promise.resolve({ data: [] }),
      ]);
      setHaVotoCapitano(!!(vc || []).length);

      const prArricchite = applicaVotoArricchito(pr || [], vr || [], vc || [], [p], stag || []);
      const votoById = {};
      prArricchite.forEach((r) => { votoById[r.giocatore_id] = r.voto; });

      setRighe((pr || []).map((r) => {
        const g = giocMap[r.giocatore_id];
        const d = dmMap[r.giocatore_id];
        const voto = votoById[r.giocatore_id];
        return {
          ...r,
          nome: g?.nome || "Giocatore",
          nickname: g?.nickname,
          foto_url: g?.foto_url,
          ruolo: r.ruolo || g?.ruolo_prevalente || "—",
          voto: voto == null ? null : Number(voto),
          gol: d?.gol_manuale != null ? d.gol_manuale : r.gol,
          assist: d?.assist || 0,
          clean_sheet: !!d?.clean_sheet,
          cartellini: d?.cartellini || 0,
          autogol: d?.autogol || 0,
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
          if (gTop) setLeader({ nome: gTop.nickname || mappaNomi[top.gid] || gTop.nome, punti: top.punti });
        }
      }

      setStato("ok");
    })();
  }, [id]);

  if (stato === "verifica") return <div className="centered">Caricamento…</div>;
  if (stato === "no-login" || stato === "no-consenso" || stato === "no-membro") {
    return <div className="centered">Accesso riservato ai membri della lega. <a className="plink" href="/">← Vai al login</a></div>;
  }
  if (stato === "errore") return (
    <div className="centered">
      Non siamo riusciti a caricare questa partita.<br />
      <span style={{ fontSize: 12, opacity: .7 }}>{errore}</span><br />
      <a className="plink" href="/?sezione=partite">Torna alle partite</a>
    </div>
  );
  if (stato === "non-trovata") return <div className="centered">Partita non trovata. <a className="plink" href="/">← Torna a Scarsi League</a></div>;

  const squadre = [partita.squadra_1, partita.squadra_2];
  const punteggioLive = partita.stato_live ? calcolaPunteggioLive(prestazioniRaw, datiManualiRaw) : null;
  const gol = punteggioLive
    ? [punteggioLive[squadre[0]] || 0, punteggioLive[squadre[1]] || 0]
    : [partita.gol_squadra_1, partita.gol_squadra_2];
  const forza = [partita.forza_squadra_1, partita.forza_squadra_2];

  const perSquadra = (nome) =>
    righe.filter((r) => r.squadra === nome).sort((a, b) => (b.voto ?? -1) - (a.voto ?? -1));

  // se i capitani hanno votato questa partita, l'MVP segue il voto (già
  // arricchito) più alto invece del flag motm importato da Fubles
  const mvp = haVotoCapitano
    ? [...righe].filter((r) => r.voto != null).sort((a, b) => b.voto - a.voto)[0]
    : righe.find((r) => r.motm);
  const migliorVoto = [...righe].filter((r) => r.voto != null).sort((a, b) => b.voto - a.voto)[0];
  const peggiorVoto = [...righe].filter((r) => r.voto != null).sort((a, b) => a.voto - b.voto)[0];
  const capocannoniereMatch = [...righe].filter((r) => r.gol > 0).sort((a, b) => b.gol - a.gol)[0];

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
    <>
      <AppNav active="partite" />
      <div className="wrap navpad">
        <div className="brand">
          <h1>Scarsi <em>League</em></h1>
          <span className="season"><a className="plink" href="/?sezione=partite">← Torna alle partite</a></span>
        </div>

      <section className="hero" style={{ marginTop: 20 }}>
        {partita.stato_live === "in_corso" && <div className="note" style={{ color: "#E05C4B", fontWeight: 700 }}>🔴 IN DIRETTA</div>}
        <span className="lbl">{fmtData(partita.data, { year: true })}{partita.struttura ? ` · ${partita.struttura}` : ""}</span>
        <div className="team"><b>{squadre[0]}</b>{forza[0] != null && <span>forza {forza[0]}</span>}</div>
        <div className="score">{gol[0]}<span>–</span>{gol[1]}</div>
        <div className="team"><b>{squadre[1]}</b>{forza[1] != null && <span>forza {forza[1]}</span>}</div>
        {mvp && <div className="mvpline">⭐ MVP <b>{mvp.nickname || mvp.nome}</b> · voto {mvp.voto ?? "—"}</div>}
      </section>

      <div className="reportbar">
        <ReportButton testo={reportText} />
        <RecapImageButton
          nomeFile={`scarsi-league-${partita.data}.png`}
          dati={{
            legaNome: partita.struttura || "",
            dataTesto: fmtData(partita.data, { year: true }),
            squadra1: squadre[0], squadra2: squadre[1], gol1: gol[0], gol2: gol[1],
            mvp: mvp ? { nome: mvp.nickname || mvp.nome, voto: mvp.voto } : null,
            scarso: peggiorVoto && peggiorVoto.giocatore_id !== mvp?.giocatore_id
              ? { nome: peggiorVoto.nickname || peggiorVoto.nome, voto: peggiorVoto.voto } : null,
            marcatore: capocannoniereMatch ? { nome: capocannoniereMatch.nickname || capocannoniereMatch.nome, gol: capocannoniereMatch.gol } : null,
          }}
        />
        {partita.fubles_url && (
          <a className="plink" href={partita.fubles_url} target="_blank" rel="noreferrer">Vedi su Fubles ↗</a>
        )}
      </div>

      {premiPartita.length > 0 && (
        <div className="insight">
          {premiPartita.map((p) => {
            const g = righe.find((r) => r.giocatore_id === p.giocatore_id);
            const nome = g ? (g.nickname || g.nome) : "Giocatore";
            return <div key={p.id}>{p.emoji || "🏆"} <b>{p.etichetta || p.tipo}</b> — {nome}</div>;
          })}
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

      <SubTabs active={tab} onSelect={setTab} tabs={[
        { key: "formazioni", label: "Formazioni" },
        { key: "commenti", label: "Commenti" },
        ...(mieSquadreCapitano.length || sonoGestore ? [{ key: "squadra", label: "Squadra" }] : []),
        ...(sonoCronista ? [{ key: "live", label: "🔴 Live" }] : []),
      ]} />

      {tab === "formazioni" && (
        <>
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
        </>
      )}

      {tab === "commenti" && (
        <CommentiPartita partitaId={id} legaId={partita.lega_id} mioEmail={mioEmail} sonoGestore={sonoGestore} />
      )}

      {tab === "squadra" && (
        <>
          {mieSquadreCapitano.length > 0 ? (
            <p className="season" style={{ marginTop: 16 }}>
              Sei capitano — inserisci marcatori, assist e cartellini per la tua squadra.
            </p>
          ) : (
            <div className="note" style={{ marginTop: 16 }}>
              👁 Vista da gestore: qui sotto vedi e puoi modificare esattamente quello che vede
              un capitano per ciascuna squadra (non vedi invece i moduli "proponi per l'altra
              squadra" e "vota gli avversari", riservati a chi è davvero nominato capitano — li
              gestisci comunque dal pannello admin).
            </div>
          )}
          {(mieSquadreCapitano.length ? mieSquadreCapitano : squadre).map((squadra) => (
            <CapitanoSquadra key={squadra} partitaId={id} squadra={squadra} giocatori={giocatoriMap} />
          ))}
          {mieSquadreCapitano.length > 0 && (
            <>
              <VotiCapitano
                partitaId={id}
                mieSquadre={mieSquadreCapitano}
                tutteLeSquadre={squadre}
                giocatori={giocatoriMap}
                mioEmail={mioEmail}
              />
              <ProposteIncrociate
                partitaId={id}
                mioEmail={mioEmail}
                mieSquadre={mieSquadreCapitano}
                tutteLeSquadre={squadre}
                giocatori={giocatoriMap}
                legaId={partita.lega_id}
              />
            </>
          )}
        </>
      )}

      {tab === "live" && (
        <>
          <h2>🔴 Live</h2>
          <p className="season" style={{ marginTop: 4 }}>
            Sei il cronista di questa partita — ogni tocco salva subito, ha la priorità sull'import Fubles di fine partita.
          </p>
          <LiveCronista
            partitaId={id}
            squadre={squadre}
            giocatori={giocatoriMap}
            onChange={async () => {
              const { data: dm } = await supabase.from("dati_manuali").select("*").eq("partita_id", id);
              setDatiManualiRaw(dm || []);
            }}
          />
        </>
      )}
      </div>
    </>
  );
}
