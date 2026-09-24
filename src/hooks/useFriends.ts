import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

export interface Friend extends Tables<"profiles"> {
  friendshipId: string;
}

type FriendshipRow = Tables<"friendships"> & {
  profile1: Tables<"profiles"> | null;
  profile2: Tables<"profiles"> | null;
};

export function useFriends() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const friendshipsQuery = useQuery({
    queryKey: ["friendships", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("friendships")
        .select("*, profile1:profiles!friendships_user_id_1_fkey(*), profile2:profiles!friendships_user_id_2_fkey(*)")
        .or(`user_id_1.eq.${user.id},user_id_2.eq.${user.id}`);
      if (error) throw error;
      return (data ?? []) as FriendshipRow[];
    },
    enabled: !!user,
  });

  const addFriendById = useMutation({
    mutationFn: async (friendId: string) => {
      if (!user) throw new Error("Not authenticated");
      if (friendId === user.id) throw new Error("Você não pode se adicionar como amigo.");

      // Check if friendship already exists
      const { data: existing } = await supabase
        .from("friendships")
        .select("id")
        .or(`and(user_id_1.eq.${user.id},user_id_2.eq.${friendId}),and(user_id_1.eq.${friendId},user_id_2.eq.${user.id})`)
        .maybeSingle();

      if (existing) throw new Error("Amizade já existe.");

      const { error } = await supabase.from("friendships").insert({
        user_id_1: user.id,
        user_id_2: friendId,
        requested_by: user.id,
        status: "pending",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["friendships"] });
      toast({ title: "Solicitação enviada!" });
    },
    onError: (error) => {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    },
  });

  const acceptFriend = useMutation({
    mutationFn: async (friendshipId: string) => {
      const { error } = await supabase
        .from("friendships")
        .update({ status: "accepted" })
        .eq("id", friendshipId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["friendships"] });
      toast({ title: "Amizade aceita!" });
    },
  });

  const removeFriend = useMutation({
    mutationFn: async (friendshipId: string) => {
      const { error } = await supabase.from("friendships").delete().eq("id", friendshipId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["friendships"] });
      toast({ title: "Amigo removido." });
    },
  });

  // Perfil do outro lado da amizade, com o id da amizade para aceitar/remover
  const toFriends = (rows: FriendshipRow[]): Friend[] =>
    rows.flatMap((f) => {
      const profile = f.user_id_1 === user?.id ? f.profile2 : f.profile1;
      return profile ? [{ ...profile, friendshipId: f.id }] : [];
    });

  const friendships = friendshipsQuery.data ?? [];
  const acceptedFriends = toFriends(friendships.filter((f) => f.status === "accepted"));
  const pendingReceived = toFriends(friendships.filter((f) => f.status === "pending" && f.requested_by !== user?.id));
  const pendingSent = toFriends(friendships.filter((f) => f.status === "pending" && f.requested_by === user?.id));

  return {
    friendshipsQuery,
    acceptedFriends,
    pendingReceived,
    pendingSent,
    addFriendById,
    acceptFriend,
    removeFriend,
  };
}
