import { tier, cardStats } from "../lib/engine";

export default function PlayerCard({ s, size = "lg", onClick, badges }) {
  const t = tier(s.overall);
  return (
    <div className={`fut ${t} ${size}`} onClick={onClick} role={onClick ? "button" : undefined} tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => e.key === "Enter" && onClick() : undefined}>
      <div className="fut-top">
        <div className="fut-ov">{s.overall}</div>
        <div className="fut-pos">{s.ruolo}</div>
        <div className="fut-num">{s.numero ? `#${s.numero}` : `${s.presenze} pres.`}</div>
      </div>
      {s.foto
        ? <img className="fut-foto" src={s.foto} alt={s.nome} />
        : <div className="fut-avatar">{s.nome.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()}</div>}
      <div className="fut-name" title={s.nome}>{s.nick || s.nome}</div>
      {badges && badges.length > 0 && (
        <div className="fut-badges">
          {badges.map((b) => <span key={b.id} className="fut-badge" title={b.nome}>{b.icon}</span>)}
        </div>
      )}
      {size === "lg" && (
        <div className="fut-stats">
          {cardStats(s).map(([k, v]) => <div key={k}><b>{v}</b><span>{k}</span></div>)}
        </div>
      )}
    </div>
  );
}
