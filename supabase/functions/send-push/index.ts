import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Minimal VAPID JWT builder (no external deps)
async function buildVapidJwt(audience: string, subject: string, privateKeyB64: string): Promise<string> {
  const header = { alg: "ES256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const payload = { aud: audience, exp: now + 43200, sub: subject };

  const encode = (obj: object) =>
    btoa(JSON.stringify(obj)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");

  const signingInput = `${encode(header)}.${encode(payload)}`;

  // Import private key
  const keyBytes = Uint8Array.from(atob(privateKeyB64), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey(
    "pkcs8",
    keyBytes,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  );

  const sig = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    new TextEncoder().encode(signingInput)
  );

  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");

  return `${signingInput}.${sigB64}`;
}

async function sendWebPush(
  subscription: { endpoint: string; p256dh: string; auth: string },
  payload: string,
  vapidPublicKey: string,
  vapidPrivateKey: string,
  vapidSubject: string
) {
  const url = new URL(subscription.endpoint);
  const audience = `${url.protocol}//${url.host}`;

  const jwt = await buildVapidJwt(audience, vapidSubject, vapidPrivateKey);
  const vapidAuth = `vapid t=${jwt},k=${vapidPublicKey}`;

  // Encrypt payload with ECDH + AES-GCM (RFC 8291)
  const authBytes = Uint8Array.from(atob(subscription.auth.replace(/-/g, "+").replace(/_/g, "/")), c => c.charCodeAt(0));
  const receiverPublicKeyBytes = Uint8Array.from(atob(subscription.p256dh.replace(/-/g, "+").replace(/_/g, "/")), c => c.charCodeAt(0));

  const senderKeys = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const senderPublicKeyRaw = new Uint8Array(await crypto.subtle.exportKey("raw", senderKeys.publicKey));

  const receiverKey = await crypto.subtle.importKey("raw", receiverPublicKeyBytes, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const sharedBits = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: receiverKey }, senderKeys.privateKey, 256));

  // HKDF for content encryption key and nonce
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const prk = await crypto.subtle.importKey("raw", sharedBits, { name: "HKDF" }, false, ["deriveBits"]);

  const authInfo = new TextEncoder().encode("Content-Encoding: auth\0");
  const authIkm = new Uint8Array(await crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt: authBytes, info: authInfo }, prk, 256
  ));

  const keyInfo = buildInfo("aesgcm", receiverPublicKeyBytes, senderPublicKeyRaw);
  const nonceInfo = buildInfo("nonce", receiverPublicKeyBytes, senderPublicKeyRaw);

  const ikm = await crypto.subtle.importKey("raw", authIkm, { name: "HKDF" }, false, ["deriveBits"]);
  const contentKey = new Uint8Array(await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt, info: keyInfo }, ikm, 128));
  const nonce = new Uint8Array(await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt, info: nonceInfo }, ikm, 96));

  const aesKey = await crypto.subtle.importKey("raw", contentKey, { name: "AES-GCM" }, false, ["encrypt"]);
  const plaintext = new TextEncoder().encode(payload);
  const padded = new Uint8Array([0, 0, ...plaintext]); // 2-byte padding length
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, aesKey, padded));

  const body = new Uint8Array(salt.length + 4 + 1 + senderPublicKeyRaw.length + ciphertext.length);
  let offset = 0;
  body.set(salt, offset); offset += salt.length;
  // record size (4096)
  body[offset++] = 0; body[offset++] = 0; body[offset++] = 16; body[offset++] = 0;
  body[offset++] = senderPublicKeyRaw.length;
  body.set(senderPublicKeyRaw, offset); offset += senderPublicKeyRaw.length;
  body.set(ciphertext, offset);

  const response = await fetch(subscription.endpoint, {
    method: "POST",
    headers: {
      "Authorization": vapidAuth,
      "Content-Type": "application/octet-stream",
      "Content-Encoding": "aesgcm",
      "Encryption": `salt=${btoa(String.fromCharCode(...salt)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_")}`,
      "Crypto-Key": `dh=${btoa(String.fromCharCode(...senderPublicKeyRaw)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_")}`,
      "TTL": "60",
    },
    body,
  });

  return response;
}

function buildInfo(type: string, receiverKey: Uint8Array, senderKey: Uint8Array): Uint8Array {
  const label = new TextEncoder().encode(`Content-Encoding: ${type}\0P-256\0`);
  const info = new Uint8Array(label.length + 2 + receiverKey.length + 2 + senderKey.length);
  let i = 0;
  info.set(label, i); i += label.length;
  info[i++] = 0; info[i++] = receiverKey.length;
  info.set(receiverKey, i); i += receiverKey.length;
  info[i++] = 0; info[i++] = senderKey.length;
  info.set(senderKey, i);
  return info;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { userIds, notification } = await req.json();
    // notification: { title, body, url }

    const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY");
    const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY");
    const vapidSubject = Deno.env.get("VAPID_SUBJECT") ?? "mailto:admin@spliteasy.app";

    if (!vapidPublicKey || !vapidPrivateKey) {
      throw new Error("VAPID keys não configuradas.");
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: subs, error } = await supabase
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth")
      .in("user_id", userIds);

    if (error) throw error;
    if (!subs || subs.length === 0) {
      return new Response(JSON.stringify({ sent: 0 }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const payload = JSON.stringify(notification);
    const results = await Promise.allSettled(
      subs.map((sub: any) => sendWebPush(sub, payload, vapidPublicKey, vapidPrivateKey, vapidSubject))
    );

    const sent = results.filter((r) => r.status === "fulfilled").length;

    return new Response(JSON.stringify({ sent, total: subs.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
