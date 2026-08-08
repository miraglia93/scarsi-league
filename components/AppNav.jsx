import { IconShield, IconBall, IconTrophy, IconJersey, IconPlayer } from "./icons";

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
export default function AppNav({ active, onNavigate, iniziali, notifiche = {} }) {
  const href = (k) => `/?sezione=${k}`;
  const click = (k) => (e) => { if (onNavigate) { e.preventDefault(); onNavigate(k); } };

  return (
    <>
      <nav className="topbar">
        <a className="tb-brand" href="/">Scarsi <em>League</em></a>
        {VOCI.slice(0, 4).map(({ key, label, Icon }) => (
          <a key={key} href={href(key)} className={active === key ? "on" : ""} onClick={click(key)}>
            <span className="tb-icwrap">
              <Icon size={19} />
              {notifiche[key] && <span className="notifica-dot" />}
            </span> {label}
          </a>
        ))}
        <span className="tb-spacer" />
        <a className={`tb-avatar${active === "tu" ? " on" : ""}`} href={href("tu")} onClick={click("tu")}
          title="Tu" aria-label="Tu">
          <span className="tb-hex">{iniziali || <IconPlayer size={16} />}</span>
          {notifiche.tu && <span className="notifica-dot notifica-dot-avatar" />}
        </a>
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
