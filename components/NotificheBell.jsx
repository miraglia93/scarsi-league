"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient";

function tempoFa(iso) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "ora";
  if (diff < 3600) return `${Math.floor(diff / 60)} min fa`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} h fa`;
  return `${Math.floor(diff / 86400)} g fa`;
}

// autonoma come MenuAccount/SelettoreLega: si idrata da sola (sessione
// + fetch iniziale), poi resta in ascolto via Supabase Realtime sugli
// INSERT su "notifiche" per il proprio indirizzo — badge sempre aggiornato
// senza bisogno di ricaricare la pagina.
export default function NotificheBell() {
  const [email, setEmail] = useState(null);
  const [notifiche, setNotifiche] = useState([]);
  const [aperto, setAperto] = useState(false);
  const ref = useRef(null);

  const carica = async (mail) => {
    const { data } = await supabase.from("notifiche").select("*")
      .eq("email", mail).order("creato_il", { ascending: false }).limit(20);
    setNotifiche(data || []);
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const mail = (session?.user?.email || "").toLowerCase();
      if (!mail) return;
      setEmail(mail);
      carica(mail);
    });
  }, []);

  useEffect(() => {
    if (!email) return;
    const channel = supabase.channel(`notifiche-${email}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifiche", filter: `email=eq.${email}` },
        (payload) => setNotifiche((n) => [payload.new, ...n].slice(0, 20)))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [email]);

  useEffect(() => {
    const chiudiFuori = (e) => { if (ref.current && !ref.current.contains(e.target)) setAperto(false); };
    document.addEventListener("mousedown", chiudiFuori);
    return () => document.removeEventListener("mousedown", chiudiFuori);
  }, []);

  if (!email) return null;

  const nonLette = notifiche.filter((n) => !n.letta).length;

  const apriNotifica = async (n) => {
    if (!n.letta) {
      setNotifiche((ns) => ns.map((x) => (x.id === n.id ? { ...x, letta: true } : x)));
      supabase.from("notifiche").update({ letta: true }).eq("id", n.id).then(() => {});
    }
    setAperto(false);
    if (n.url) window.location.href = n.url;
  };

  const segnaTutteLette = async () => {
    const idsNonLette = notifiche.filter((n) => !n.letta).map((n) => n.id);
    if (!idsNonLette.length) return;
    setNotifiche((ns) => ns.map((n) => ({ ...n, letta: true })));
    await supabase.from("notifiche").update({ letta: true }).in("id", idsNonLette);
  };

  return (
    <div className="ma-wrap" ref={ref}>
      <button type="button" className={`tb-avatar nb-btn${aperto ? " on" : ""}`} onClick={() => setAperto((v) => !v)}
        aria-label="Notifiche">
        <span className="tb-hex nb-hex">🔔</span>
        {nonLette > 0 && <span className="nb-badge">{nonLette > 9 ? "9+" : nonLette}</span>}
      </button>
      {aperto && (
        <div className="sl-panel ma-panel nb-panel">
          <div className="nb-header">
            <span className="sl-titolo" style={{ margin: 0 }}>Notifiche</span>
            {nonLette > 0 && <button type="button" className="nb-marktutte" onClick={segnaTutteLette}>Segna tutte lette</button>}
          </div>
          {notifiche.length === 0 ? (
            <p className="sl-vuoto">Nessuna notifica per ora</p>
          ) : (
            <div className="nb-list">
              {notifiche.map((n) => (
                <button type="button" key={n.id} className={`nb-riga${n.letta ? "" : " nb-non-letta"}`}
                  onClick={() => apriNotifica(n)}>
                  <span className="nb-titolo">{n.titolo}</span>
                  {n.corpo && <span className="nb-corpo">{n.corpo}</span>}
                  <span className="nb-tempo">{tempoFa(n.creato_il)}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
