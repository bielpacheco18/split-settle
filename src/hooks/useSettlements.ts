import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

export function useSettlements() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const settlementsQuery = useQuery({
    queryKey: ["settlements", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("settlements")
        .select("*, from_profile:profiles!settlements_from_user_id_fkey(id, name, email), to_profile:profiles!settlements_to_user_id_fkey(id, name, email)")
        .or(`from_user_id.eq.${user.id},to_user_id.eq.${user.id}`)
        .order("settled_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user,
  });

  const deleteSettlement = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("settlements").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settlements"] });
      queryClient.invalidateQueries({ queryKey: ["balances"] });
      toast({ title: "Pagamento removido." });
    },
    onError: (error) => {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    },
  });

  return { settlementsQuery, deleteSettlement };
}
