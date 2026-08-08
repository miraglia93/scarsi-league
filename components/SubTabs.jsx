// tabs: [{ key, label, href? }] — con href è un link vero (altra pagina), senza è un bottone locale
export default function SubTabs({ tabs, active, onSelect }) {
  return (
    <div className="subtabs">
      {tabs.map((t) => (
        t.href
          ? <a key={t.key} href={t.href} className={active === t.key ? "on" : ""}>{t.label}</a>
          : <button key={t.key} type="button" className={active === t.key ? "on" : ""} onClick={() => onSelect(t.key)}>{t.label}</button>
      ))}
    </div>
  );
}
