import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Subscribes to Supabase Realtime channels for all tables that affect
 * balances, expenses, settlements and friendships.
 * Automatically invalidates the relevant React Query caches on changes.
 */
export function useRealtime() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel("app-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "expenses" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["expenses"] });
          queryClient.invalidateQueries({ queryKey: ["balances"] });
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "expense_participants" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["expenses"] });
          queryClient.invalidateQueries({ queryKey: ["balances"] });
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "settlements" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["balances"] });
          queryClient.invalidateQueries({ queryKey: ["settlements"] });
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "friendships" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["friendships"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, queryClient]);
}
