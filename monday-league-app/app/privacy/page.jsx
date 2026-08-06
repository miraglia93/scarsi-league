export const metadata = { title: "Privacy Policy — Scarsi League" };

export default function Privacy() {
  return (
    <div className="wrap" style={{ maxWidth: 720 }}>
      <h1>Privacy <em>Policy</em></h1>
      <p className="season">Scarsi League · Calci8Lunedì — versione 2026-08</p>

      <h2>Chi siamo</h2>
      <p>
        Scarsi League è il sito privato della lega amatoriale di calciotto
        &quot;Calci8Lunedì&quot; (Centro Sportivo Bettinelli, Milano). Il titolare del
        trattamento è Alessandro Miraglia, organizzatore della lega, contattabile
        tramite il gruppo WhatsApp della lega o via email.
      </p>

      <h2>Quali dati raccogliamo</h2>
      <p>
        <b>Se ti registri</b>: la tua email (per l&apos;accesso) e, se usi Google,
        il nome del tuo account. <b>Come giocatore</b>: nome visualizzato su
        Fubles, ruolo, presenze, risultati, gol, voti delle pagelle e premi,
        importati dalle pagine pubbliche delle partite su Fubles a cui hai
        partecipato.
      </p>

      <h2>Perché e per quanto</h2>
      <p>
        Solo per le statistiche, classifiche e i giochi della lega. Nessuna
        pubblicità, nessuna cessione a terzi, nessuna profilazione. I dati
        restano finché la lega esiste o finché non chiedi la rimozione.
      </p>

      <h2>Chi li vede</h2>
      <p>
        Solo i membri della lega approvati dall&apos;organizzatore. Il sito non è
        pubblico né indicizzato. I dati sono ospitati su Supabase (server in UE)
        e Vercel.
      </p>

      <h2>I tuoi diritti</h2>
      <p>
        Puoi chiedere in qualsiasi momento di vedere, correggere o rimuovere i
        tuoi dati (anche solo di essere anonimizzato nelle statistiche, tipo
        &quot;Giocatore #12&quot;): basta scriverlo ad Alessandro. Rispondiamo prima
        del fischio d&apos;inizio del lunedì successivo. Hai anche il diritto di
        reclamo al Garante Privacy (gpdp.it).
      </p>

      <p className="season" style={{ marginTop: 40 }}>
        <a className="plink" href="/">← Torna a Scarsi League</a>
      </p>
    </div>
  );
}
