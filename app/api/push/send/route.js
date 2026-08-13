import webpush from "web-push";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

// client e chiavi VAPID inizializzati al primo utilizzo, non al load del modulo:
// altrimenti il build fallisce in locale se le env var server-only non sono impostate
let supabaseAdmin = null;
function getSupabaseAdmin() {
  if (!supabaseAdmin) {
    supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  }
  return supabaseAdmin;
}

let vapidPronto = false;
function assicuraVapid() {
  if (!vapidPronto) {
    webpush.setVapidDetails(
      "mailto:miraglia93@gmail.com",
      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY
    );
    vapidPronto = true;
  }
}

async function emailDestinatari(tipo, body) {
  const db = getSupabaseAdmin();
  const { lega_id } = body;
  if (tipo === "richiesta_accesso") {
    const { data } = await db.from("membri_autorizzati").select("email")
      .eq("lega_id", lega_id).in("ruolo", ["admin", "coorganizzatore"]);
    return (data || []).map((r) => r.email);
  }
  if (tipo === "richiesta_approvata") {
    return body.email ? [body.email.toLowerCase()] : [];
  }
  if (tipo === "nuova_partita") {
    const { data } = await db.from("membri_autorizzati").select("email").eq("lega_id", lega_id);
    return (data || []).map((r) => r.email);
  }
  if (tipo === "premio_assegnato") {
    const { data } = await db.from("membri_autorizzati").select("email")
      .eq("lega_id", lega_id).eq("giocatore_id", body.giocatore_id);
    return (data || []).map((r) => r.email);
  }
  return [];
}

async function costruisciMessaggio(tipo, body) {
  let legaNome = "la tua lega";
  if (tipo === "richiesta_accesso" || tipo === "richiesta_approvata") {
    const { data } = await getSupabaseAdmin().from("leghe").select("nome").eq("id", body.lega_id).maybeSingle();
    if (data?.nome) legaNome = data.nome;
  }
  switch (tipo) {
    case "richiesta_accesso":
      return { titolo: "Nuova richiesta di accesso", corpo: `${body.nome || "Qualcuno"} vuole entrare in ${legaNome}`, url: "/admin" };
    case "richiesta_approvata":
      return { titolo: "Richiesta approvata ✅", corpo: `Sei entrato in ${legaNome}`, url: "/" };
    case "nuova_partita":
      return { titolo: "Nuova partita disponibile ⚽", corpo: body.label || "È stata importata una nuova partita", url: "/?sezione=partite" };
    case "premio_assegnato":
      return { titolo: "Hai vinto un premio! 🏅", corpo: body.etichetta || "Controlla la tua bacheca", url: "/" };
    default:
      return null;
  }
}

export async function POST(req) {
  const body = await req.json().catch(() => null);
  if (!body?.tipo) return Response.json({ error: "tipo mancante" }, { status: 400 });

  assicuraVapid();
  const db = getSupabaseAdmin();

  const msg = await costruisciMessaggio(body.tipo, body);
  if (!msg) return Response.json({ error: "tipo sconosciuto" }, { status: 400 });

  const emails = await emailDestinatari(body.tipo, body);
  if (!emails.length) return Response.json({ inviate: 0 });

  const { data: subs } = await db.from("push_subscriptions").select("*").in("email", emails);

  let inviate = 0;
  await Promise.all((subs || []).map(async (s) => {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify(msg)
      );
      inviate++;
    } catch (err) {
      if (err.statusCode === 404 || err.statusCode === 410) {
        await db.from("push_subscriptions").delete().eq("id", s.id);
      }
    }
  }));

  return Response.json({ inviate });
}
