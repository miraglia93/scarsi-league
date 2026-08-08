// La stagione appare come etichetta ("Stagione 2026/27") ma è in realtà una
// select: sembra un'informazione fissa, resta comunque possibile cambiarla
// (nessuna perdita di funzionalità rispetto al vecchio selettore in nav).
export default function ContextBar({ stagioni, stagioneSel, onStagioneChange, leghe, legaId, onLegaChange }) {
  const haStagioni = stagioni && stagioni.length > 0;
  if (!haStagioni && !(leghe && leghe.length > 1)) return null;
  return (
    <div className="ctxstrip">
      {haStagioni && (
        <select className="ctx-stagione" value={stagioneSel} onChange={(e) => onStagioneChange(e.target.value === "all" ? "all" : Number(e.target.value))}>
          <option value="all">Tutte le stagioni</option>
          {stagioni.map((s) => <option key={s.id} value={s.id}>Stagione {s.nome}{s.attiva ? " · in corso" : ""}</option>)}
        </select>
      )}
      {leghe && leghe.length > 1 && (
        <select value={legaId ?? ""} onChange={(e) => onLegaChange(Number(e.target.value))}>
          {leghe.map((l) => <option key={l.id} value={l.id}>{l.nome}</option>)}
        </select>
      )}
    </div>
  );
}
