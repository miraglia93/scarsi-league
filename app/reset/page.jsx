"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

export default function Reset() {
  const [stato, setStato] = useState("verifica"); // verifica | pronto | no-sessione | fatto
  const [password, setPassword] = useState("");
  const [conferma, setConferma] = useState("");
  const [mostraPassword, setMostraPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setStato(session ? "pronto" : "no-sessione");
    });
  }, []);

  const salva = async () => {
    setErr("");
    if (password.length < 8) { setErr("La password deve avere almeno 8 caratteri."); return; }
    if (password !== conferma) { setErr("Le due password non coincidono."); return; }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) setErr(error.message); else setStato("fatto");
  };

  if (stato === "verifica") return <div className="centered">Verifica in corso…</div>;

  if (stato === "no-sessione") {
    return (
      <div className="login">
        <h1>Scarsi <em>League</em></h1>
        <p className="msg">
          Il link non è valido o è scaduto. <a className="plink" href="/">Torna al login</a> e
          richiedi un nuovo link da &quot;Password dimenticata?&quot;.
        </p>
      </div>
    );
  }

  if (stato === "fatto") {
    return (
      <div className="login">
        <h1>Scarsi <em>League</em></h1>
        <p className="msg">✅ Password aggiornata! <a className="plink" href="/">Vai al login</a>.</p>
      </div>
    );
  }

  return (
    <div className="login">
      <h1>Scarsi <em>League</em></h1>
      <p className="season">Imposta una nuova password</p>
      <div className="pwdfield">
        <input type={mostraPassword ? "text" : "password"} placeholder="Nuova password" value={password}
          onChange={(e) => setPassword(e.target.value)} />
        <button type="button" className="pwdtoggle" onClick={() => setMostraPassword((v) => !v)} aria-label="Mostra/nascondi password">
          {mostraPassword ? "🙈" : "👁"}
        </button>
      </div>
      <input type={mostraPassword ? "text" : "password"} placeholder="Conferma password" value={conferma}
        onChange={(e) => setConferma(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && password && conferma && salva()} />
      <button onClick={salva} disabled={busy || !password || !conferma}>
        {busy ? "Salvataggio…" : "Salva nuova password"}
      </button>
      {err && <p className="msg">⚠ {err}</p>}
    </div>
  );
}
