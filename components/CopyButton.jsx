"use client";

import { useState } from "react";

// bottone "copia negli appunti" con fallback per i browser senza Clipboard API
export default function CopyButton({ text, label, labelCopiato = "Copiato ✅", className = "mini ok" }) {
  const [stato, setStato] = useState("idle"); // idle | copiato | errore

  const copia = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      setStato("copiato");
      setTimeout(() => setStato("idle"), 2000);
    } catch {
      setStato("errore");
      setTimeout(() => setStato("idle"), 3000);
    }
  };

  return (
    <button type="button" className={className} onClick={copia}>
      {stato === "copiato" ? labelCopiato : stato === "errore" ? "⚠ Copia manualmente" : label}
    </button>
  );
}
