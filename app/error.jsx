"use client";

export default function ErrorePagina({ error, reset }) {
  return (
    <div className="centered" style={{ padding: "12vh 20px", textAlign: "center" }}>
      <h1 style={{ marginBottom: 8 }}>Qualcosa <em>è andato storto</em></h1>
      <p className="msg">
        Non è colpa tua — abbiamo urtato un imprevisto. Prova a ricaricare, oppure torna
        alla home.
      </p>
      {error?.message && (
        <p className="msg" style={{ fontSize: 12, opacity: .6, marginTop: 8 }}>{error.message}</p>
      )}
      <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 18 }}>
        <button onClick={() => reset()}>Riprova</button>
        <a className="plink" href="/" style={{ alignSelf: "center" }}>← Torna alla home</a>
      </div>
    </div>
  );
}
