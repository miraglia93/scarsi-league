export const metadata = { title: "Privacy Policy — Scarsi League" };

export default function Privacy() {
  return (
    <div className="wrap" style={{ maxWidth: 720 }}>
      <h1>Privacy <em>Policy</em></h1>
      <p className="season">Scarsi League — versione 2026-10</p>

      <h2>Chi siamo</h2>
      <p>
        Scarsi League è una piattaforma che trasforma i dati delle partite di
        calcetto/calciotto importati da Fubles in statistiche, carte giocatore
        e classifiche, organizzate per lega. Ogni lega ha un proprio
        organizzatore (l&apos;admin che l&apos;ha creata), che decide chi entra e
        gestisce i dati della propria lega — è lui il titolare del trattamento
        per i dati della tua lega, contattabile tramite il gruppo della lega
        o dal profilo dell&apos;admin nel pannello. Per domande sulla piattaforma
        in generale scrivi a miraglia93@gmail.com.
      </p>

      <h2>Quali dati raccogliamo</h2>
      <p>
        <b>Se ti registri</b>: la tua email (per l&apos;accesso), nome e cognome
        (per riconoscerti nella lega) e, facoltativo, il tuo numero di
        telefono — solo per essere contattato in caso di imprevisti prima
        di una partita (es. un rinvio). Nome, cognome e telefono sono
        legati al tuo account, non a una singola lega: se entri in più
        leghe restano gli stessi ovunque. <b>Come giocatore</b>: nome
        visualizzato su Fubles, ruolo, presenze, risultati, gol, voti
        delle pagelle e premi, importati dalle pagine pubbliche delle
        partite su Fubles a cui hai partecipato.
      </p>

      <h2>Perché e per quanto</h2>
      <p>
        Solo per le statistiche, classifiche e i giochi della tua lega.
        Nessuna pubblicità, nessuna cessione a terzi, nessuna profilazione.
        I dati restano finché la lega esiste o finché non chiedi la
        rimozione; l&apos;organizzatore può anche eliminare l&apos;intera lega in
        qualsiasi momento, cancellando tutti i dati collegati.
      </p>

      <h2>Chi li vede</h2>
      <p>
        Solo i membri della tua lega, approvati dal suo organizzatore. Le
        leghe sono isolate tra loro: chi gioca in una lega non vede i dati
        di un&apos;altra. Il sito non è indicizzato dai motori di ricerca. I dati
        sono ospitati su Supabase (server in UE) e Vercel.
      </p>

      <h2>I tuoi diritti</h2>
      <p>
        Puoi chiedere in qualsiasi momento di vedere, correggere o rimuovere i
        tuoi dati (anche solo di essere anonimizzato nelle statistiche, tipo
        &quot;Giocatore #12&quot;): basta scriverlo all&apos;organizzatore della tua
        lega. Hai anche il diritto di reclamo al Garante Privacy (gpdp.it).
      </p>

      <p className="season" style={{ marginTop: 40 }}>
        <a className="plink" href="/">← Torna a Scarsi League</a>
      </p>
    </div>
  );
}
