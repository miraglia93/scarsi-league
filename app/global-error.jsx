"use client";

// scatta solo se l'errore è nel layout radice stesso: qui dobbiamo
// ridisegnare <html>/<body> perché sostituiamo tutto, niente CSS globale
// disponibile con certezza, quindi stile minimo inline.
export default function ErroreGlobale({ reset }) {
  return (
    <html lang="it">
      <body style={{
        background: "#0B1210", color: "#E8EDE6", fontFamily: "Archivo, sans-serif",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        minHeight: "100vh", textAlign: "center", padding: 20,
      }}>
        <h1 style={{ color: "#E3C567" }}>Scarsi League</h1>
        <p>Qualcosa è andato storto. Prova a ricaricare la pagina.</p>
        <button
          onClick={() => reset()}
          style={{ marginTop: 14, padding: "10px 18px", background: "#E3C567", color: "#0B1210", border: "none", borderRadius: 8, fontWeight: 700, cursor: "pointer" }}
        >
          Riprova
        </button>
      </body>
    </html>
  );
}
