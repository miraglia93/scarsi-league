"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

// genera il QR interamente lato client (nessun servizio esterno a cui
// mandare il link di invito)
export default function CodiceQR({ testo, dimensione = 180 }) {
  const [src, setSrc] = useState(null);

  useEffect(() => {
    let attivo = true;
    QRCode.toDataURL(testo, {
      width: dimensione, margin: 1,
      color: { dark: "#0B1210", light: "#E8EDE6" },
    }).then((url) => { if (attivo) setSrc(url); });
    return () => { attivo = false; };
  }, [testo, dimensione]);

  if (!src) return null;
  return <img src={src} alt="Codice QR di invito alla lega" width={dimensione} height={dimensione} style={{ borderRadius: 8 }} />;
}
