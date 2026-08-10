"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { assemble, buildStats, computeXP, computeLivello, tradErroreDb } from "../../lib/engine";
import AppNav from "../../components/AppNav";
import { IconEdit, IconLock, IconLogout } from "../../components/icons";
import SpiegaXP from "../../components/SpiegaXP";

// "statistiche complete": a differenza di Lega → Tu (il cartellino di
// UNA lega specifica), qui sommiamo le statistiche su TUTTE le leghe
// dove hai una scheda collegata — è la pagina a cui porta "La tua
// bacheca" nel menu account, non un duplicato della sezione Lega.
export default function Bacheca() {
  const [stato, setStato] = useState("verifica"); // verifica | no-login | ok
  const [identita, setIdentita] = useState(null);
  const [perLega, setPerLega] = useState([]);
  const [aggregato, setAggregato] = useState(null);
  const [errore, setErrore] = useState("");

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setStato("no-login"); return; }
      const mail = (session.user?.email || "").toLowerCase();

      const { data: idRow } = await supabase.from("utenti_piattaforma")
        .select("nome, cognome").eq("email", mail).maybeSingle();
      setIdentita(idRow || null);

      const { data: mie, error: mieErr } = await supabase.from("membri_autorizzati")
        .select("lega_id, giocatore_id").eq("email", mail);
      if (mieErr) { setErrore(tradErroreDb(mieErr.message)); setStato("ok"); return; }

      const claimed = (mie || []).filter((m) => m.giocatore_id != null);
      if (!claimed.length) { setStato("ok"); return; }

      const legaIds = claimed.map((m) => m.lega_id);
      const { data: leghe } = await supabase.from("leghe").select("id, nome").in("id", legaIds);
      const nomeLega = {};
      (leghe || []).forEach((l) => { nomeLega[l.id] = l.nome; });

      const risultati = await Promise.all(claimed.map(async (m) => {
        const { data: pa } = await supabase.from("partite").select("*").eq("lega_id", m.lega_id);
        if (!pa || !pa.length) return null;
        const paIds = pa.map((p) => p.id);
        const [{ data: pr }, { data: vo }, { data: gi }, { data: dm }] = await Promise.all([
          supabase.from("prestazioni").select("*").in("partita_id", paIds),
          supabase.from("voti_ricevuti").select("*").in("partita_id", paIds),
          supabase.from("giocatori").select("*").eq("lega_id", m.lega_id),
          supabase.from("dati_manuali").select("*").in("partita_id", paIds),
        ]);
        const { P, matches } = assemble(pa, gi || [], pr || [], vo || []);
        const S = buildStats(P, matches);
        const s = S[m.giocatore_id];
        if (!s || !s.storico?.length) return null;
        const dmByChiave = {};
        (dm || []).forEach((d) => { dmByChiave[`${d.partita_id}_${d.giocatore_id}`] = d; });
        const xp = computeXP(s, dmByChiave);
        return { legaId: m.lega_id, legaNome: nomeLega[m.lega_id] || "Lega", s, xp };
      }));

      const validi = risultati.filter(Boolean);
      setPerLega(validi);

      if (validi.length) {
        const tot = { presenze: 0, gol: 0, mvp: 0, sommaVoto: 0, xpTotale: 0, ripartizione: {} };
        validi.forEach(({ s, xp }) => {
          tot.presenze += s.presenze;
          tot.gol += s.gol;
          tot.mvp += s.mvp;
          tot.sommaVoto += s.mediaVoto * s.presenze;
          tot.xpTotale += xp.totale;
          Object.entries(xp.ripartizione).forEach(([k, v]) => { tot.ripartizione[k] = (tot.ripartizione[k] || 0) + v; });
        });
        setAggregato({
          presenze: tot.presenze, gol: tot.gol, mvp: tot.mvp,
          mediaVoto: tot.presenze ? tot.sommaVoto / tot.presenze : 0,
          xp: { totale: tot.xpTotale, ripartizione: tot.ripartizione, livello: computeLivello(tot.xpTotale) },
        });
      }
      setStato("ok");
    })();
  }, []);

  if (stato === "verifica") return <div className="centered">Caricamento…</div>;
  if (stato === "no-login") return <div className="centered"><a className="plink" href="/">Fai login per continuare</a></div>;

  const nomeCompleto = identita?.nome ? `${identita.nome} ${identita.cognome}` : null;

  return (
    <>
      <AppNav active="tu" />
      <div className="wrap navpad">
        <div className="brand">
          <h1>{nomeCompleto || "La tua"} <em>Bacheca</em></h1>
          <span className="season">Statistiche su tutte le tue leghe</span>
        </div>

        {errore && <div className="note">⚠ {errore}</div>}

        {!identita?.nome && (
          <div className="note">
            Completa nome e cognome per personalizzare questa pagina — te li chiede
            il sito al prossimo accesso, oppure <a className="plink" href="/">torna alla home</a>.
          </div>
        )}

        {perLega.length === 0 ? (
          <p className="season">
            Non hai ancora una scheda collegata in nessuna lega. Dentro una lega,
            vai su <a className="plink" href="/profilo">Modifica profilo</a> per
            collegare la tua e iniziare a vedere le statistiche qui.
          </p>
        ) : (
          <>
            {aggregato && (
              <>
                <div className="kv">
                  <div className="stat"><b>{aggregato.presenze}</b><span>Presenze totali</span></div>
                  <div className="stat"><b>{aggregato.gol}</b><span>Gol totali</span></div>
                  <div className="stat"><b>{aggregato.mediaVoto.toFixed(2)}</b><span>Media voto</span></div>
                  <div className="stat"><b>{aggregato.mvp}</b><span>MVP totali</span></div>
                  <div className="stat"><b>{perLega.length}</b><span>Leghe</span></div>
                </div>

                <div className="xpcard">
                  <div className="xp-top">
                    <span className="xp-livello">{aggregato.xp.livello.nome}</span>
                    <span className="xp-totale"><b>{aggregato.xp.totale}</b> XP totali (tutte le leghe)</span>
                  </div>
                  <div className="xpbar"><i style={{ width: `${Math.round(aggregato.xp.livello.progresso * 100)}%` }} /></div>
                  <div className="xp-prossimo">
                    {aggregato.xp.livello.prossimoNome
                      ? `${aggregato.xp.totale} / ${aggregato.xp.livello.sogliaProssimo} XP verso "${aggregato.xp.livello.prossimoNome}"`
                      : "Livello massimo raggiunto 🏆"}
                  </div>
                  <div className="xp-ripartizione">
                    <div><b>{aggregato.xp.ripartizione.presenze || 0}</b><span>Presenze</span></div>
                    <div><b>{aggregato.xp.ripartizione.vittorie || 0}</b><span>Risultati</span></div>
                    <div><b>{aggregato.xp.ripartizione.gol || 0}</b><span>Gol</span></div>
                    <div><b>{aggregato.xp.ripartizione.assist || 0}</b><span>Assist</span></div>
                    <div><b>{aggregato.xp.ripartizione.mvp || 0}</b><span>MVP</span></div>
                    <div><b>{aggregato.xp.ripartizione.voto || 0}</b><span>Voti alti</span></div>
                    <div><b>{aggregato.xp.ripartizione.cleanSheet || 0}</b><span>Clean sheet</span></div>
                  </div>
                  <SpiegaXP />
                </div>
              </>
            )}

            <h2>Per lega</h2>
            <div style={{ overflowX: "auto" }}>
              <table>
                <thead><tr>
                  <th>Lega</th><th className="num">Presenze</th><th className="num">Gol</th>
                  <th className="num">Media voto</th><th className="num">MVP</th>
                </tr></thead>
                <tbody>
                  {perLega.map((r) => (
                    <tr key={r.legaId}>
                      <td className="pname">{r.legaNome}</td>
                      <td className="num">{r.s.presenze}</td>
                      <td className="num">{r.s.gol}</td>
                      <td className="num">{r.s.mediaVoto.toFixed(2)}</td>
                      <td className="num">{r.s.mvp}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        <div className="menulist" style={{ marginTop: 24 }}>
          <a className="menu-item" href="/profilo"><IconEdit /> Modifica profilo</a>
          <a className="menu-item" href="/privacy"><IconLock /> Privacy</a>
          <button type="button" className="menu-item danger" onClick={() => supabase.auth.signOut()}><IconLogout /> Esci</button>
        </div>
      </div>
    </>
  );
}
