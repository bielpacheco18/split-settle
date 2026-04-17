import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string;

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export type PushPermission = "default" | "granted" | "denied" | "unsupported";

export function usePushNotifications() {
  const { user } = useAuth();
  const [permission, setPermission] = useState<PushPermission>("default");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) {
      setPermission("unsupported");
      return;
    }
    setPermission(Notification.permission as PushPermission);
  }, []);

  const subscribe = useCallback(async () => {
    if (!user || !VAPID_PUBLIC_KEY) return false;
    setLoading(true);
    try {
      const perm = await Notification.requestPermission();
      setPermission(perm as PushPermission);
      if (perm !== "granted") return false;

      const reg = await navigator.serviceWorker.ready;
      const existing = await reg.pushManager.getSubscription();
      if (existing) await existing.unsubscribe();

      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });

      const json = subscription.toJSON();
      const { error } = await supabase.from("push_subscriptions" as any).upsert({
        user_id: user.id,
        endpoint: json.endpoint!,
        p256dh: (json.keys as any).p256dh,
        auth: (json.keys as any).auth,
      }, { onConflict: "user_id,endpoint" });

      if (error) throw error;
      return true;
    } catch (err) {
      console.error("Push subscribe error:", err);
      return false;
    } finally {
      setLoading(false);
    }
  }, [user]);

  const unsubscribe = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await sub.unsubscribe();
        await supabase.from("push_subscriptions" as any)
          .delete()
          .eq("user_id", user.id)
          .eq("endpoint", sub.endpoint);
      }
      setPermission("default");
    } finally {
      setLoading(false);
    }
  }, [user]);

  return { permission, loading, subscribe, unsubscribe };
}

// Call this after creating an expense to notify participants
export async function notifyExpenseParticipants(
  participantUserIds: string[],
  expenseDescription: string,
  payerName: string,
  amount: number
) {
  if (!participantUserIds.length) return;
  try {
    await supabase.functions.invoke("send-push", {
      body: {
        userIds: participantUserIds,
        notification: {
          title: "Nova despesa adicionada",
          body: `${payerName} adicionou "${expenseDescription}" — R$ ${amount.toFixed(2)}`,
          url: "/history",
        },
      },
    });
  } catch (err) {
    console.error("Push notification error:", err);
  }
}

// Call this after creating a settlement to notify recipient
export async function notifySettlement(
  recipientUserId: string,
  payerName: string,
  amount: number
) {
  try {
    await supabase.functions.invoke("send-push", {
      body: {
        userIds: [recipientUserId],
        notification: {
          title: "Pagamento recebido!",
          body: `${payerName} te pagou R$ ${amount.toFixed(2)}`,
          url: "/",
        },
      },
    });
  } catch (err) {
    console.error("Push notification error:", err);
  }
}
