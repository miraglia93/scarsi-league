"use client";

import { supabase } from "./supabaseClient";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

export function pushSupportato() {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && !!VAPID_PUBLIC_KEY;
}

export async function statoPush() {
  if (!pushSupportato()) return "non-supportato";
  if (Notification.permission === "denied") return "negato";
  const reg = await navigator.serviceWorker.getRegistration("/sw.js");
  const sub = await reg?.pushManager.getSubscription();
  return sub ? "attivo" : "spento";
}

export async function attivaPush(email) {
  const reg = await navigator.serviceWorker.register("/sw.js");
  const permesso = await Notification.requestPermission();
  if (permesso !== "granted") throw new Error("Permesso negato dal browser");
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
  });
  const json = sub.toJSON();
  const { error } = await supabase.from("push_subscriptions").upsert({
    email, endpoint: json.endpoint, p256dh: json.keys.p256dh, auth: json.keys.auth,
  }, { onConflict: "endpoint" });
  if (error) throw error;
}

export async function disattivaPush() {
  const reg = await navigator.serviceWorker.getRegistration("/sw.js");
  const sub = await reg?.pushManager.getSubscription();
  if (sub) {
    await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
    await sub.unsubscribe();
  }
}

// best-effort: non deve mai bloccare il flusso principale se fallisce
export function inviaPush(payload) {
  fetch("/api/push/send", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
  }).catch(() => {});
}
