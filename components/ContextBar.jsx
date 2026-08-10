// La stagione appare come etichetta ("Stagione 2026/27") ma è in realtà una
// select: la freccina la segnala come cambiabile senza appesantirla con lo
// stile "casella" di una select vera e propria.
// (la scelta della lega vive nel selettore in alto accanto al logo, non qui)
export default function ContextBar({ stagioni, stagioneSel, onStagioneChange }) {
  const haStagioni = stagioni && stagioni.length > 0;
  if (!haStagioni) return null;
  return (
    <div className="ctxstrip">
      <label className="ctx-stagione-wrap">
        <select className="ctx-stagione" value={stagioneSel} onChange={(e) => onStagioneChange(e.target.value === "all" ? "all" : Number(e.target.value))}>
          <option value="all">Tutte le stagioni</option>
          {stagioni.map((s) => <option key={s.id} value={s.id}>Stagione {s.nome}{s.attiva ? " · in corso" : ""}</option>)}
        </select>
        <span className="ctx-arrow" aria-hidden="true">▾</span>
      </label>
    </div>
  );
}
