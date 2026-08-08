"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import AppNav from "../../components/AppNav";

export default function Profilo() {
  const [stato, setStato] = useState("verifica"); // verifica | no-login | no-membro | ok
  const [me, setMe] = useState(null);            // riga membri_autorizzati
  const [giocatori, setGiocatori] = useState([]);
  const [claimed, setClaimed] = useState([]);
  const [scelta, setScelta] = useState("");
  const [scheda, setScheda] = useState(null);    // riga giocatori rivendicata
  const [nickname, setNickname] = useState("");
  const [numero, setNumero] = useState("");
  const [ruolo, setRuolo] = useState("CEN");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const carica = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    const mail = (user?.email || "").toLowerCase();
    const { data: m } = await supabase.from("membri_autorizzati")
      .select("*").eq("email", mail).maybeSingle();
    if (!m) { setStato("no-membro"); return; }
    setMe(m);
    const [{ data: g }, { data: c }] = await Promise.all([
      supabase.from("giocatori").select("*").order("nome"),
      supabase.from("v_giocatori_claimed").select("*"),
    ]);
    setGiocatori(g || []);
    setClaimed((c || []).map((x) => x.giocatore_id));
    if (m.giocatore_id) {
      const mia = (g || []).find((x) => x.id === m.giocatore_id);
      setScheda(mia || null);
      setNickname(mia?.nickname || "");
      setNumero(mia?.numero_maglia ?? "");
      setRuolo(mia?.ruolo_prevalente || "CEN");
    } else {
      setScheda(null);
    }
    setStato("ok");
  };

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setStato("no-login"); return; }
      carica();
    })();
  }, []);

  const claim = async (gid) => {
    setBusy(true); setMsg("");
    const { data, error } = await supabase.rpc("claim_giocatore", { gid });
    setBusy(false);
    if (error || data !== "ok") setMsg("⚠ " + (error?.message || data));
    else { setMsg(gid ? "✅ Scheda collegata!" : "Scheda scollegata"); carica(); }
  };

  const salva = async () => {
    setBusy(true); setMsg("");
    const { error } = await supabase.from("giocatori").update({
      nickname: nickname || null,
      numero_maglia: numero === "" ? null : Number(numero),
      ruolo_prevalente: ruolo,
    }).eq("id", scheda.id);
    setBusy(false);
    setMsg(error ? "⚠ " + error.message : "✅ Profilo salvato");
    if (!error) carica();
  };

  const caricaFoto = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !scheda) return;
    setBusy(true); setMsg("");
    const { data: { user } } = await supabase.auth.getUser();
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
    const path = `${user.id}.${ext}`;
    const { error: upErr } = await supabase.storage.from("avatars")
      .upload(path, file, { upsert: true, contentType: file.type });
    if (upErr) { setBusy(false); setMsg("⚠ Upload: " + upErr.message); return; }
    const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
    const url = pub.publicUrl + "?v=" + Date.now(); // bypass cache dopo cambio foto
    const { error } = await supabase.from("giocatori").update({ foto_url: url }).eq("id", scheda.id);
    setBusy(false);
    setMsg(error ? "⚠ " + error.message : "✅ Foto aggiornata");
    if (!error) carica();
  };

  if (stato === "verifica") return <div className="centered">Caricamento profilo…</div>;
  if (stato === "no-login") return <div className="centered"><a className="plink" href="/">Fai login per continuare</a></div>;
  if (stato === "no-membro") return <div className="centered">Il tuo accesso non è ancora approvato. <a className="plink" href="/">← Torna al sito</a></div>;

  const liberi = giocatori.filter((g) => !claimed.includes(g.id));

  return (
    <>
      <AppNav active="tu" />
      <div className="wrap navpad" style={{ maxWidth: 720 }}>
      <div className="brand">
        <h1>Il tuo <em>Profilo</em></h1>
        <span className="season"><a className="plink" href="/?sezione=tu">← Torna alla bacheca</a></span>
      </div>
      <p className="season" style={{ marginTop: 8 }}>{me.email} {me.ruolo === "admin" && "· 👑 admin"}</p>
      {msg && <div className="note" style={{ marginTop: 10 }}>{msg}</div>}

      {!scheda ? (
        <>
          <h2>Chi sei in campo?</h2>
          <p>Collega il tuo account alla tua scheda giocatore: statistiche, carta e voti diventano tuoi.</p>
          <select value={scelta} onChange={(e) => setScelta(e.target.value)}>
            <option value="">— Scegli il tuo nome come appare su Fubles —</option>
            {liberi.map((g) => <option key={g.id} value={g.id}>{g.nome}</option>)}
          </select>
          <button className="mini ok" style={{ marginTop: 12 }} disabled={!scelta || busy}
            onClick={() => claim(Number(scelta))}>Sono io ✋</button>
          <p className="season" style={{ marginTop: 16 }}>
            Non ti trovi? Comparirai dopo la tua prima partita importata.
          </p>
        </>
      ) : (
        <>
          <h2>La tua scheda: {scheda.nome}</h2>
          <div className="profilogrid">
            <div>
              {scheda.foto_url
                ? <img className="profilofoto" src={scheda.foto_url} alt="La tua foto" />
                : <div className="profilofoto vuota">{scheda.nome.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()}</div>}
              <label className="mini ok filelabel">
                📷 {scheda.foto_url ? "Cambia foto" : "Carica foto"}
                <input type="file" accept="image/*" onChange={caricaFoto} hidden />
              </label>
            </div>
            <div>
              <label className="flabel">Nickname da calciatore</label>
              <input placeholder='es. "Il Muro di Milano"' value={nickname} onChange={(e) => setNickname(e.target.value)} />
              <label className="flabel">Numero di maglia</label>
              <input type="number" min="1" max="99" placeholder="93" value={numero} onChange={(e) => setNumero(e.target.value)} />
              <label className="flabel">Ruolo preferito</label>
              <select value={ruolo} onChange={(e) => setRuolo(e.target.value)}>
                <option value="POR">Portiere</option>
                <option value="DIF">Difensore</option>
                <option value="CEN">Centrocampista</option>
                <option value="ATT">Attaccante</option>
              </select>
              <button className="mini ok" style={{ marginTop: 14 }} onClick={salva} disabled={busy}>💾 Salva profilo</button>
            </div>
          </div>
          <p className="season" style={{ marginTop: 20 }}>
            Scheda sbagliata? <a className="plink" href="#" onClick={(e) => { e.preventDefault(); claim(null); }}>Scollega</a>
          </p>
        </>
      )}
      </div>
    </>
  );
}
