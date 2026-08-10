/* ============================================================
   SCARSI LEAGUE — immagine riepilogo partita, pronta da condividere
   nel gruppo WhatsApp. Disegnata a mano su <canvas>: nessuna libreria
   nuova, solo la Canvas API del browser.
   ============================================================ */

const W = 1080, H = 1080;
const ORO = "#E3C567", GESSO = "#E8EDE6", MUTO = "#8FA096", BG = "#0B1210";

function scriviCentrato(ctx, testo, x, y, { font, colore = GESSO, maxWidth = W - 120 }) {
  ctx.font = font;
  ctx.fillStyle = colore;
  ctx.textAlign = "center";
  let f = font;
  // se il nome è troppo lungo per la larghezza della card, restringe il font
  while (ctx.measureText(testo).width > maxWidth) {
    const taglia = parseInt(f, 10);
    if (taglia <= 24) break;
    f = f.replace(/^\d+/, String(taglia - 4));
    ctx.font = f;
  }
  ctx.fillText(testo, x, y);
}

function rigaPremio(ctx, y, { emoji, etichetta, nome, valore }) {
  const cx = W / 2;
  ctx.fillStyle = "rgba(227,197,103,0.08)";
  ctx.beginPath();
  ctx.roundRect(90, y - 62, W - 180, 108, 16);
  ctx.fill();

  ctx.textAlign = "left";
  ctx.font = "54px Archivo, sans-serif";
  ctx.fillText(emoji, 122, y + 16);

  ctx.font = "700 22px Archivo, sans-serif";
  ctx.fillStyle = MUTO;
  ctx.fillText(etichetta.toUpperCase(), 200, y - 10);

  ctx.font = "700 34px Archivo, sans-serif";
  ctx.fillStyle = GESSO;
  const nomeTagliato = nome.length > 22 ? nome.slice(0, 21) + "…" : nome;
  ctx.fillText(nomeTagliato, 200, y + 28);

  if (valore) {
    ctx.textAlign = "right";
    ctx.font = "800 36px Anton, sans-serif";
    ctx.fillStyle = ORO;
    ctx.fillText(valore, W - 122, y + 14);
  }
  ctx.textAlign = "left";
}

// datiPartita: { legaNome, dataTesto, squadra1, squadra2, gol1, gol2, mvp, scarso, marcatore }
// mvp/scarso: { nome, voto } o null. marcatore: { nome, gol } o null.
export async function generaImmagineRecap(datiPartita) {
  if (typeof document === "undefined") return null;
  if (document.fonts?.ready) await document.fonts.ready;

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, W, H);
  const grad = ctx.createRadialGradient(W / 2, 0, 0, W / 2, 0, H * 0.85);
  grad.addColorStop(0, "rgba(72,120,86,0.32)");
  grad.addColorStop(1, "rgba(11,18,16,0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // wordmark: "SCARSI" chalk + "LEAGUE" oro, come logo
  ctx.font = "64px Anton, sans-serif";
  const wScarsi = ctx.measureText("SCARSI ").width;
  const wLeague = ctx.measureText("LEAGUE").width;
  const startX = W / 2 - (wScarsi + wLeague) / 2;
  ctx.textAlign = "left";
  ctx.fillStyle = GESSO;
  ctx.fillText("SCARSI ", startX, 110);
  ctx.fillStyle = ORO;
  ctx.fillText("LEAGUE", startX + wScarsi, 110);

  scriviCentrato(ctx, `${datiPartita.legaNome} · ${datiPartita.dataTesto}`, W / 2, 158,
    { font: "700 24px Archivo, sans-serif", colore: MUTO });

  // punteggio
  scriviCentrato(ctx, datiPartita.squadra1.toUpperCase(), W / 2, 280, { font: "800 44px Anton, sans-serif" });
  scriviCentrato(ctx, `${datiPartita.gol1}  –  ${datiPartita.gol2}`, W / 2, 420, { font: "160px Anton, sans-serif", colore: ORO });
  scriviCentrato(ctx, datiPartita.squadra2.toUpperCase(), W / 2, 490, { font: "800 44px Anton, sans-serif" });

  ctx.strokeStyle = "rgba(232,237,230,0.15)";
  ctx.beginPath();
  ctx.moveTo(140, 560);
  ctx.lineTo(W - 140, 560);
  ctx.stroke();

  let y = 660;
  if (datiPartita.mvp) {
    rigaPremio(ctx, y, { emoji: "⭐", etichetta: "MVP della serata", nome: datiPartita.mvp.nome, valore: datiPartita.mvp.voto?.toFixed(2) });
    y += 138;
  }
  if (datiPartita.scarso) {
    rigaPremio(ctx, y, { emoji: "🗑", etichetta: "Bidone della serata", nome: datiPartita.scarso.nome, valore: datiPartita.scarso.voto?.toFixed(2) });
    y += 138;
  }
  if (datiPartita.marcatore) {
    rigaPremio(ctx, y, { emoji: "⚽", etichetta: "Marcatore di serata", nome: datiPartita.marcatore.nome, valore: `${datiPartita.marcatore.gol}` });
  }

  scriviCentrato(ctx, "scarsileague.it", W / 2, H - 50, { font: "700 26px Archivo, sans-serif", colore: MUTO });

  return new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
}
