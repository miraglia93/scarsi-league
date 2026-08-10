/* ============================================================
   SCARSI LEAGUE — bookmarklet "Importa da Fubles"
   Gira interamente nel browser dell'admin, sulla pagina partita di
   Fubles che ha già aperto lui stesso: legge solo quello che è già
   renderizzato a schermo (nessuna richiesta aggiuntiva verso Fubles,
   nessuna apertura automatica di altre pagine/profili — per questo i
   giocatori sono identificati per nome, non per id Fubles: leggere
   l'id richiederebbe aprire il profilo di ognuno). Copia il risultato
   negli appunti, pronto per l'incolla nel pannello di gestione lega.
   ============================================================ */

// eslint-disable-next-line no-unused-vars
const SORGENTE_BOOKMARKLET = `
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
    var panel = function () { return group.querySelector('.mat-tab-body-active'); };

    clickTab('DETTAGLI');
    await wait(500);
    var p1 = panel();
    var h3 = Array.prototype.slice.call(p1.querySelectorAll('h3')).map(function (h) { return h.textContent.trim(); }).filter(Boolean);
    var squadra1 = h3[0] || null, squadra2 = h3[1] || null;
    var scoreEl = p1.querySelector('.score');
    var scoreMatch = ((scoreEl && scoreEl.textContent) || '').match(/(\\d+)\\s*-\\s*(\\d+)/);
    var gol1 = scoreMatch ? Number(scoreMatch[1]) : 0;
    var gol2 = scoreMatch ? Number(scoreMatch[2]) : 0;

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

    clickTab('PAGELLE');
    await wait(500);
    var cards = document.querySelectorAll('.grades mat-card');
    if (!cards.length) { alert('Non trovo le pagelle: la partita deve essere già disputata e con le pagelle visibili.'); return; }

    var giocatori = Array.prototype.map.call(cards, function (c) {
      var nomeEl = c.querySelector('.player .name');
      var ruoloEl = c.querySelector('.player .gray');
      var votoEl = c.querySelector('.vote strong');
      var golEl = c.querySelectorAll('.vote .gray')[0];
      var golMatch = (golEl ? golEl.textContent : '').match(/(\\d+)/);
      var teamSrc = (c.querySelector('.avatar img.team') || {}).src || '';
      var squadra = teamSrc.indexOf('side1') !== -1 ? squadra1 : teamSrc.indexOf('side2') !== -1 ? squadra2 : null;
      var mvp = !!c.querySelector('mat-icon[svgicon="cockard"]');
      var votiRicevuti = Array.prototype.slice.call(c.querySelectorAll('.vote-row')).map(function (row) {
        var voter = row.querySelector('.voter');
        var vote = row.querySelector('.vote');
        return {
          votante: voter ? voter.textContent.trim() : null,
          voto: vote ? Number(vote.textContent.trim().replace(',', '.')) : null,
        };
      }).filter(function (v) { return v.votante && v.voto != null; });

      return {
        nome: nomeEl ? nomeEl.textContent.trim() : null,
        ruolo: ruoloEl ? ruoloEl.textContent.trim() : null,
        voto: votoEl ? Number(votoEl.textContent.trim().replace(',', '.')) : null,
        gol: golMatch ? Number(golMatch[1]) : 0,
        mvp: mvp,
        squadra: squadra,
        voti_ricevuti: votiRicevuti,
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
      gol_squadra_1: gol1,
      gol_squadra_2: gol2,
      giocatori: giocatori,
    };

    var testo = JSON.stringify(payload);
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(testo);
      alert('Copiato! Vai su Scarsi League \\u2192 Lega \\u2192 Gestione \\u2192 Partite \\u2192 "Importa da Fubles (link)" e incolla.');
    } else {
      window.prompt('Copia questo testo e incollalo su Scarsi League:', testo);
    }
  } catch (e) {
    alert('Qualcosa \\u00e8 andato storto: ' + e.message);
  }
})();
`;

export function bookmarkletHref() {
  return `javascript:${encodeURIComponent(SORGENTE_BOOKMARKLET.trim())}`;
}
