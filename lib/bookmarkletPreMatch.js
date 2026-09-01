/* ============================================================
   SCARSI LEAGUE — bookmarklet "Importa formazione pre-partita"
   Mirror di bookmarklet.js, ma legge la tab "FORMAZIONI" di Fubles
   PRIMA che la partita sia giocata: nomi squadra, forza, elenco
   giocatori con ruolo — niente voti/gol/MVP, che non esistono ancora.
   Stesso match_id della pagina che si userà per l'import post-partita
   di sempre, quindi la stessa chiave anti-duplicati funziona identica.
   ============================================================ */

// eslint-disable-next-line no-unused-vars
const SORGENTE_BOOKMARKLET_PRE_MATCH = `
(async function () {
  try {
    var wait = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
    var mm = location.pathname.match(/matches\\/(\\d+)/);
    if (!mm) { alert('Apri prima una pagina partita di Fubles (…/matches/12345), poi riclicca questo bottone.'); return; }
    var matchId = mm[1];

    var groups = document.querySelectorAll('mat-tab-group');
    var group = groups[groups.length - 1];
    if (!group) { alert('Pagina non riconosciuta: assicurati di essere sulla pagina di una partita.'); return; }

    var clickTab = function (label) {
      var tabs = Array.prototype.slice.call(group.querySelectorAll('.mat-tab-label'));
      var t = tabs.filter(function (x) { return x.textContent.trim() === label; })[0];
      if (t) t.click();
    };

    var bodyText = document.body.innerText;
    var mDisc = bodyText.match(/Calcio a (\\d+)\\s*[•·]\\s*(Coperto|Scoperto)/i);
    var disciplina = mDisc ? ('Calcio a ' + mDisc[1]) : null;
    var copertoScoperto = mDisc ? mDisc[2] : null;
    var MESI = { gen: '01', feb: '02', mar: '03', apr: '04', mag: '05', giu: '06', lug: '07', ago: '08', set: '09', ott: '10', nov: '11', dic: '12' };
    var mData = bodyText.match(/[a-zà]{3}\\s+(\\d{1,2})\\s+([a-zà]{3})\\s+(\\d{4})\\s*-\\s*(\\d{1,2}:\\d{2})/i);
    var dataIso = null, ora = null;
    if (mData) {
      var giorno = mData[1].padStart(2, '0');
      var mese = MESI[mData[2].toLowerCase()] || '01';
      dataIso = mData[3] + '-' + mese + '-' + giorno;
      ora = mData[4];
    }
    var mLuogo = bodyText.match(/location_on\\s*\\n([^\\n]+)\\n([^\\n]+)/);
    var struttura = mLuogo ? mLuogo[1].trim() : null;
    var indirizzo = mLuogo ? mLuogo[2].trim() : null;
    var mPub = bodyText.match(/Partita (pubblica|privata)/i);
    var pubblicaPrivata = mPub ? (mPub[1].toLowerCase() === 'pubblica' ? 'Pubblica' : 'Privata') : null;

    clickTab('FORMAZIONI');
    await wait(500);

    var h3Squadre = Array.prototype.slice.call(document.querySelectorAll('.badges .badge h3'));
    if (h3Squadre.length < 2) { alert('Non trovo le formazioni: assicurati che la pagina mostri già le due squadre nella tab FORMAZIONI.'); return; }
    var squadra1 = h3Squadre[0].textContent.trim();
    var squadra2 = h3Squadre[1].textContent.trim();

    var forzaEls = Array.prototype.slice.call(document.querySelectorAll('.my-progress p'));
    var forza1 = forzaEls[0] ? Number(forzaEls[0].textContent.trim()) : null;
    var forza2 = forzaEls[1] ? Number(forzaEls[1].textContent.trim()) : null;

    var playerEls = Array.prototype.slice.call(document.querySelectorAll('.players .player.full'));
    if (!playerEls.length) { alert('Nessun giocatore trovato nella formazione.'); return; }

    var giocatori = playerEls.map(function (el) {
      var nomeEl = el.querySelector('h3.name');
      var ruoloEl = el.querySelector('.role');
      var squadraSinistra = !!el.querySelector('.level-bar.left-side');
      return {
        nome: nomeEl ? nomeEl.textContent.trim() : null,
        ruolo: ruoloEl ? ruoloEl.textContent.trim() : null,
        squadra: squadraSinistra ? squadra1 : squadra2,
      };
    }).filter(function (g) { return g.nome; });

    var payload = {
      match_id: matchId,
      fubles_url: location.href,
      data: dataIso,
      ora: ora,
      disciplina: disciplina,
      coperto_scoperto: copertoScoperto,
      struttura: struttura,
      indirizzo: indirizzo,
      pubblica_privata: pubblicaPrivata,
      squadra_1: squadra1,
      squadra_2: squadra2,
      forza_squadra_1: forza1,
      forza_squadra_2: forza2,
      giocatori: giocatori,
    };

    var testo = JSON.stringify(payload);
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(testo);
      alert('Copiato! Vai su Scarsi League \\u2192 Lega \\u2192 Gestione \\u2192 Partite \\u2192 Importa \\u2192 "Importa formazione pre-partita" e incolla.');
    } else {
      window.prompt('Copia questo testo e incollalo su Scarsi League:', testo);
    }
  } catch (e) {
    alert('Qualcosa \\u00e8 andato storto: ' + e.message);
  }
})();
`;

export function bookmarkletPreMatchHref() {
  return `javascript:${encodeURIComponent(SORGENTE_BOOKMARKLET_PRE_MATCH.trim())}`;
}
