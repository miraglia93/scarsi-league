"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

export default function Leghe() {
  const [leghePubbliche, setLeghePubbliche] = useState([]);
  const [statoLeghe, setStatoLeghe] = useState("carico"); // carico | ok

  useEffect(() => {
    supabase.rpc("leghe_pubbliche").then(({ data }) => {
      setLeghePubbliche(data || []);
      setStatoLeghe("ok");
    });
  }, []);

  return (
    <div className="wrap" style={{ maxWidth: 720, paddingTop: 40, paddingBottom: 60 }}>
      <div className="brand">
        <h1>Scarsi <em>League</em></h1>
      </div>
      <p className="season" style={{ marginTop: 8 }}>
        Trasforma le partite della tua lega di calcetto in statistiche, carte
        giocatore e classifiche — senza sostituire Fubles, lo completa.
      </p>

      <h2 style={{ marginTop: 32 }}>Leghe pubbliche</h2>
      {statoLeghe === "carico" ? (
        <p className="season">Caricamento…</p>
      ) : leghePubbliche.length === 0 ? (
        <p className="season">Nessuna lega pubblica ancora — se conosci un organizzatore, chiedigli il link di invito diretto.</p>
      ) : (
        <div className="menulist">
          {leghePubbliche.map((l) => (
            <a key={l.slug} className="menu-item" href={`/?lega=${l.slug}`}>
              <div>
                <b>{l.nome}</b>
                {l.struttura && <div style={{ fontSize: 12, opacity: .7, marginTop: 2 }}>{l.struttura}</div>}
              </div>
              <span className="hint">Richiedi accesso →</span>
            </a>
          ))}
        </div>
      )}

      <h2 style={{ marginTop: 32 }}>Cosa ottieni</h2>
      <div className="grid2">
        <div className="stat" style={{ textAlign: "left" }}><b style={{ fontSize: 15 }}>🃏 Carte giocatore</b><span style={{ display: "block", textTransform: "none", letterSpacing: "normal", marginTop: 4 }}>Stile Ultimate Team, calibrate sui voti reali della tua lega</span></div>
        <div className="stat" style={{ textAlign: "left" }}><b style={{ fontSize: 15 }}>🏆 Classifiche</b><span style={{ display: "block", textTransform: "none", letterSpacing: "normal", marginTop: 4 }}>Generale, marcatori, media voto, MVP, presenze, assist</span></div>
        <div className="stat" style={{ textAlign: "left" }}><b style={{ fontSize: 15 }}>🎮 XP e livelli</b><span style={{ display: "block", textTransform: "none", letterSpacing: "normal", marginTop: 4 }}>Progressione automatica da Esordiente a Leggenda</span></div>
        <div className="stat" style={{ textAlign: "left" }}><b style={{ fontSize: 15 }}>⭐ Team of the Week</b><span style={{ display: "block", textTransform: "none", letterSpacing: "normal", marginTop: 4 }}>Formazione della giornata, pronta da condividere</span></div>
        <div className="stat" style={{ textAlign: "left" }}><b style={{ fontSize: 15 }}>🏅 Hall of Fame</b><span style={{ display: "block", textTransform: "none", letterSpacing: "normal", marginTop: 4 }}>Albo d&apos;oro di fine stagione</span></div>
        <div className="stat" style={{ textAlign: "left" }}><b style={{ fontSize: 15 }}>📊 Pagina partita</b><span style={{ display: "block", textTransform: "none", letterSpacing: "normal", marginTop: 4 }}>Formazioni, media voto, immagine e report WhatsApp con un tap</span></div>
      </div>

      <h2 style={{ marginTop: 32 }}>Non trovi la tua? Creane una</h2>
      <div className="menulist">
        <div className="menu-item" style={{ cursor: "default" }}>1️⃣ Crei la tua lega e la prima stagione, in un minuto</div>
        <div className="menu-item" style={{ cursor: "default" }}>2️⃣ Inviti i tuoi amici con un link — approvi tu chi entra</div>
        <div className="menu-item" style={{ cursor: "default" }}>3️⃣ Dopo ogni partita, importi i risultati da Fubles</div>
      </div>

      <p className="msg" style={{ marginTop: 24 }}>
        L&apos;abbonamento per creare una lega è gestito manualmente per ora —
        te lo attiviamo appena richiedi accesso.
      </p>

      <button
        onClick={() => { window.location.href = "/crea-lega"; }}
        style={{
          marginTop: 8, padding: "12px 20px", border: "none", borderRadius: 8,
          background: "#E3C567", color: "#0B1210", fontWeight: 700, cursor: "pointer",
        }}
      >
        Crea la tua lega →
      </button>

      <p className="msg" style={{ marginTop: 32, fontSize: 13, opacity: .7 }}>
        Già membro di una lega? <a className="plink" href="/">Accedi qui</a>.
      </p>
    </div>
  );
}
