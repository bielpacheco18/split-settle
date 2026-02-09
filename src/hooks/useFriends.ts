import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

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
      return data ?? [];
    },
    enabled: !!user,
  });

  const addFriend = useMutation({
    mutationFn: async (friendEmail: string) => {
      // Find user by email in auth — we need a workaround since we can't query auth.users
      // We'll search profiles by looking up all profiles (friends can only be added if they exist)
      // Actually we need to find by email. Let's use a different approach:
      // Look up the user via supabase auth admin — but we can't from client.
      // Instead, let's find profiles where email matches in auth metadata.
      // The simplest approach: search all profiles and match. But RLS prevents that.
      // Best approach: use an RPC or edge function. For now, let's use a simpler method:
      // The user enters the friend's email, we try to find their profile via a lookup.
      
      if (!user) throw new Error("Not authenticated");
      
      // We'll use a workaround: try to find the user by querying profiles
      // Since we can't query by email directly, we'll need to match via auth
      // For MVP, let's assume users share their user IDs or we add an email column to profiles
      throw new Error("Funcionalidade em desenvolvimento. Use o ID do amigo por enquanto.");
    },
    onError: (error) => {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    },
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

  // Helper to get friend profile from friendship row
  const getFriendFromFriendship = (friendship: any) => {
    if (!user) return null;
    return friendship.user_id_1 === user.id ? friendship.profile2 : friendship.profile1;
  };

  const acceptedFriends = (friendshipsQuery.data ?? [])
    .filter((f: any) => f.status === "accepted")
    .map((f: any) => ({ ...getFriendFromFriendship(f), friendshipId: f.id }));

  const pendingReceived = (friendshipsQuery.data ?? [])
    .filter((f: any) => f.status === "pending" && f.requested_by !== user?.id)
    .map((f: any) => ({ ...getFriendFromFriendship(f), friendshipId: f.id }));

  const pendingSent = (friendshipsQuery.data ?? [])
    .filter((f: any) => f.status === "pending" && f.requested_by === user?.id)
    .map((f: any) => ({ ...getFriendFromFriendship(f), friendshipId: f.id }));

  return {
    friendshipsQuery,
    acceptedFriends,
    pendingReceived,
    pendingSent,
    addFriend,
    addFriendById,
    acceptFriend,
    removeFriend,
  };
}
