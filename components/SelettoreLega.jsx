"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient";

// pill accanto al logo: apre un pannello con le tue leghe, le leghe
// pubbliche (cercabili) e un campo per un codice invito diretto.
// Autonomo: si carica i dati da sé, si può montare su qualunque pagina
// senza passargli nulla — legaAttuale e onLegaChange sono opzionali
// (solo la home li usa, per cambiare lega senza ricaricare).
export default function SelettoreLega({ legaAttuale, onLegaChange }) {
  const [aperto, setAperto] = useState(false);
  const [mieLeghe, setMieLeghe] = useState([]);
  const [pubbliche, setPubbliche] = useState([]);
  const [ricerca, setRicerca] = useState("");
  const [codice, setCodice] = useState("");
  const ref = useRef(null);

  useEffect(() => {
    supabase.from("leghe").select("*").order("nome").then(({ data }) => setMieLeghe(data || []));
  }, []);

  useEffect(() => {
    if (!aperto) return;
    const mieSlug = new Set(mieLeghe.map((l) => l.slug));
    supabase.rpc("leghe_pubbliche").then(({ data }) => {
      setPubbliche((data || []).filter((l) => !mieSlug.has(l.slug)));
    });
  }, [aperto, mieLeghe]);

  useEffect(() => {
    const chiudiFuori = (e) => { if (ref.current && !ref.current.contains(e.target)) setAperto(false); };
    document.addEventListener("mousedown", chiudiFuori);
    return () => document.removeEventListener("mousedown", chiudiFuori);
  }, []);

  const nomeAttuale = mieLeghe.find((l) => l.id === legaAttuale)?.nome;

  const sceglie = (l) => {
    setAperto(false);
    if (onLegaChange) onLegaChange(l.id);
    else window.location.href = "/";
  };

  const vaiConCodice = () => {
    if (!codice.trim()) return;
    window.location.href = `/?lega=${encodeURIComponent(codice.trim().toLowerCase())}`;
  };

  const pubblicheFiltrate = pubbliche.filter((l) => l.nome.toLowerCase().includes(ricerca.toLowerCase()));

  return (
    <div className="sl-wrap" ref={ref}>
      <button type="button" className="sl-pill" onClick={() => setAperto((v) => !v)}>
        {nomeAttuale || "Le tue leghe"} <span className="sl-arrow">▾</span>
      </button>
      {aperto && (
        <div className="sl-panel">
          {mieLeghe.length > 0 && (
            <>
              <div className="sl-titolo">Le tue leghe</div>
              {mieLeghe.map((l) => (
                <button type="button" key={l.id} className={`sl-riga${l.id === legaAttuale ? " sl-attiva" : ""}`} onClick={() => sceglie(l)}>
                  <span>{l.nome}</span>
                  {l.id === legaAttuale && <span className="sl-check">✓</span>}
                </button>
              ))}
            </>
          )}

          <div className="sl-titolo" style={{ marginTop: mieLeghe.length ? 14 : 0 }}>Leghe pubbliche</div>
          <input className="sl-input" placeholder="Cerca una lega…" value={ricerca} onChange={(e) => setRicerca(e.target.value)} />
          {pubblicheFiltrate.length === 0 ? (
            <p className="sl-vuoto">Nessuna lega trovata.</p>
          ) : pubblicheFiltrate.map((l) => (
            <a key={l.slug} className="sl-riga" href={`/?lega=${l.slug}`}>
              <span>{l.nome}</span>
              <span className="sl-hint">Richiedi accesso →</span>
            </a>
          ))}

          <div className="sl-titolo" style={{ marginTop: 14 }}>Hai un codice invito?</div>
          <div className="sl-codicebox">
            <input className="sl-input" placeholder="es. champions-giovedi" value={codice}
              onChange={(e) => setCodice(e.target.value)} onKeyDown={(e) => e.key === "Enter" && vaiConCodice()} />
            <button type="button" className="sl-vai" onClick={vaiConCodice}>Vai</button>
          </div>
        </div>
      )}
    </div>
  );
}
