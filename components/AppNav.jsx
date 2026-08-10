import { IconShield, IconBall, IconTrophy, IconJersey, IconPlayer } from "./icons";
import SelettoreLega from "./SelettoreLega";
import MenuAccount from "./MenuAccount";

const VOCI = [
  { key: "lega", label: "Lega", Icon: IconShield },
  { key: "partite", label: "Partite", Icon: IconBall },
  { key: "classifiche", label: "Classifiche", Icon: IconTrophy },
  { key: "giocatori", label: "Giocatori", Icon: IconJersey },
  { key: "tu", label: "Tu", Icon: IconPlayer },
];

// active: "lega" | "partite" | "classifiche" | "giocatori" | "tu"
// onNavigate(key): se presente, intercetta il click (navigazione interna senza reload,
// per quando siamo già su "/"); se assente, i link sono normali <a> (navigazione da altre pagine).
// notifiche: { partite?: boolean, tu?: boolean } — pallino di notifica sulla voce
export default function AppNav({ active, onNavigate, iniziali, notifiche = {}, legaAttuale, onLegaChange }) {
  const href = (k) => `/?sezione=${k}`;
  const click = (k) => (e) => { if (onNavigate) { e.preventDefault(); onNavigate(k); } };

  return (
    <>
      <nav className="topbar">
        <a className="tb-brand" href="/">Scarsi <em>League</em></a>
        <SelettoreLega legaAttuale={legaAttuale} onLegaChange={onLegaChange} />
        {VOCI.slice(0, 4).map(({ key, label, Icon }) => (
          <a key={key} href={href(key)} className={active === key ? "on" : ""} onClick={click(key)}>
            <span className="tb-icwrap">
              <Icon size={19} />
              {notifiche[key] && <span className="notifica-dot" />}
            </span> {label}
          </a>
        ))}
        <span className="tb-spacer" />
        <MenuAccount iniziali={iniziali} notificaDot={notifiche.tu} />
      </nav>

      <nav className="bottombar">
        {VOCI.map(({ key, label, Icon }) => (
          <a key={key} href={href(key)} className={active === key ? "on" : ""} onClick={click(key)}>
            <span className="bb-icwrap">
              {active === key && <span className="bb-dot" />}
              {notifiche[key] && <span className="notifica-dot" />}
              <Icon size={22} />
            </span>
            <span className="bb-label">{label}</span>
          </a>
        ))}
      </nav>
    </>
  );
}
