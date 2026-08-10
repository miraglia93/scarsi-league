"use client";

import { useState } from "react";
import { generaImmagineRecap } from "../lib/recapImage";

// genera l'immagine riepilogo al click (non prima: evita di rifarla
// ad ogni render) e la scarica come PNG pronta da condividere.
export default function RecapImageButton({ dati, nomeFile }) {
  const [stato, setStato] = useState("idle"); // idle | generando | errore

  const scarica = async () => {
    setStato("generando");
    try {
      const blob = await generaImmagineRecap(dati);
      if (!blob) throw new Error("Canvas non disponibile");
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = nomeFile;
      a.click();
      URL.revokeObjectURL(url);
      setStato("idle");
    } catch {
      setStato("errore");
      setTimeout(() => setStato("idle"), 3000);
    }
  };

  return (
    <button type="button" className="mini ok" onClick={scarica} disabled={stato === "generando"}>
      {stato === "generando" ? "Un attimo…" : stato === "errore" ? "⚠ Riprova" : "📸 Immagine da condividere"}
    </button>
  );
}
