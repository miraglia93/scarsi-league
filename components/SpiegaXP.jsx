import { PUNTI_XP, LIVELLI } from "../lib/engine";

// legenda punti/livelli, riusata sia nel cartellino per-lega che nella
// bacheca cross-lega — stessi valori di lib/engine.js, mai duplicati
export default function SpiegaXP() {
  return (
    <details className="xp-spiega">
      <summary>Come funziona l&apos;XP?</summary>
      <div className="xp-spiega-corpo">
        <p>Ogni azione in campo vale punti, sommati per sempre (mai tolti):</p>
        <div className="xp-punti">
          <span>Presenza a una partita</span><span>+{PUNTI_XP.presenza}</span>
          <span>Vittoria</span><span>+{PUNTI_XP.vittoria}</span>
          <span>Pareggio</span><span>+{PUNTI_XP.pareggio}</span>
          <span>Gol (ciascuno)</span><span>+{PUNTI_XP.gol}</span>
          <span>Assist (ciascuno)</span><span>+{PUNTI_XP.assist}</span>
          <span>MVP della partita</span><span>+{PUNTI_XP.mvp}</span>
          <span>Voto ≥ 7.5</span><span>+{PUNTI_XP.votoAlto}</span>
          <span>Voto ≥ 8</span><span>+{PUNTI_XP.votoOttimo}</span>
          <span>Clean sheet (portiere)</span><span>+{PUNTI_XP.cleanSheet}</span>
        </div>
        <p>I livelli:</p>
        <div className="xp-livelli">
          {LIVELLI.map((l) => <span key={l.nome}>{l.nome} · {l.soglia}</span>)}
        </div>
      </div>
    </details>
  );
}
