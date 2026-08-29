"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { IconPlayer } from "./icons";

// l'iniziale/avatar in alto a destra, ma cliccabile: scorciatoie rapide
// senza dover passare dalla bacheca "Tu" per intero. Autonomo come
// SelettoreLega, nessun dato da passargli oltre le iniziali da mostrare.
export default function MenuAccount({ iniziali, notificaDot }) {
  const [aperto, setAperto] = useState(false);
  const [mostraAdmin, setMostraAdmin] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const chiudiFuori = (e) => { if (ref.current && !ref.current.contains(e.target)) setAperto(false); };
    document.addEventListener("mousedown", chiudiFuori);
    return () => document.removeEventListener("mousedown", chiudiFuori);
  }, []);

  // autonomo come il resto del componente: se l'utente gestisce almeno
  // una lega (admin o coorganizzatore), mostra la scorciatoia al pannello
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      const mail = (session?.user?.email || "").toLowerCase();
      if (!mail) return;
      const { data } = await supabase.from("membri_autorizzati").select("ruolo")
        .eq("email", mail).in("ruolo", ["admin", "coorganizzatore"]).limit(1);
      setMostraAdmin(!!data?.length);
    });
  }, []);

  return (
    <div className="ma-wrap" ref={ref}>
      <button type="button" className={`tb-avatar${aperto ? " on" : ""}`} onClick={() => setAperto((v) => !v)}
        aria-label="Il tuo account">
        <span className="tb-hex">{iniziali || <IconPlayer size={16} />}</span>
        {notificaDot && <span className="notifica-dot notifica-dot-avatar" />}
      </button>
      {aperto && (
        <div className="sl-panel ma-panel">
          {mostraAdmin && <a className="sl-riga" href="/admin">⚙ Pannello admin</a>}
          <a className="sl-riga" href="/bacheca">La tua bacheca</a>
          <a className="sl-riga" href="/profilo">Modifica profilo</a>
          <a className="sl-riga" href="/privacy">Privacy</a>
          <button type="button" className="sl-riga" style={{ color: "#E88" }} onClick={() => supabase.auth.signOut()}>Esci</button>
        </div>
      )}
    </div>
  );
}
