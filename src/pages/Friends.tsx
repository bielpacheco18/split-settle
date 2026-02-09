import { useState } from "react";
import { useFriends } from "@/hooks/useFriends";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { UserPlus, Check, X, Copy } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Friends() {
  const { user } = useAuth();
  const { acceptedFriends, pendingReceived, pendingSent, addFriendById, acceptFriend, removeFriend } = useFriends();
  const [friendId, setFriendId] = useState("");
  const { toast } = useToast();

  const handleCopyId = () => {
    if (user?.id) {
      navigator.clipboard.writeText(user.id);
      toast({ title: "ID copiado!", description: "Compartilhe com seus amigos." });
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Amigos</h1>

      {/* Your ID */}
      <Card>
        <CardContent className="flex items-center justify-between p-4">
          <div>
            <p className="text-sm text-muted-foreground">Seu ID (compartilhe com amigos)</p>
            <p className="font-mono text-xs text-foreground">{user?.id}</p>
          </div>
          <Button variant="outline" size="icon" onClick={handleCopyId}>
            <Copy className="h-4 w-4" />
          </Button>
        </CardContent>
      </Card>

      {/* Add friend */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <UserPlus className="h-5 w-5" /> Adicionar amigo
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (friendId.trim()) {
                addFriendById.mutate(friendId.trim());
                setFriendId("");
              }
            }}
          >
            <Input
              placeholder="Cole o ID do amigo"
              value={friendId}
              onChange={(e) => setFriendId(e.target.value)}
            />
            <Button type="submit" disabled={addFriendById.isPending}>
              Adicionar
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Pending received */}
      {pendingReceived.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Solicitações recebidas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {pendingReceived.map((f: any) => (
              <div key={f.friendshipId} className="flex items-center justify-between rounded-lg border border-border p-3">
                <div className="flex items-center gap-3">
                  <Avatar className="h-9 w-9">
                    <AvatarFallback className="text-xs">{(f.name || "?").slice(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <span className="font-medium">{f.name || "Usuário"}</span>
                </div>
                <div className="flex gap-2">
                  <Button size="icon" variant="outline" onClick={() => acceptFriend.mutate(f.friendshipId)}>
                    <Check className="h-4 w-4 text-success" />
                  </Button>
                  <Button size="icon" variant="outline" onClick={() => removeFriend.mutate(f.friendshipId)}>
                    <X className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Pending sent */}
      {pendingSent.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Solicitações enviadas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {pendingSent.map((f: any) => (
              <div key={f.friendshipId} className="flex items-center justify-between rounded-lg border border-border p-3">
                <div className="flex items-center gap-3">
                  <Avatar className="h-9 w-9">
                    <AvatarFallback className="text-xs">{(f.name || "?").slice(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <span className="font-medium">{f.name || "Usuário"}</span>
                </div>
                <span className="text-sm text-muted-foreground">Pendente</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Accepted friends */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Seus amigos ({acceptedFriends.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {acceptedFriends.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhum amigo ainda. Adicione usando o ID!</p>
          )}
          {acceptedFriends.map((f: any) => (
            <div key={f.friendshipId} className="flex items-center justify-between rounded-lg border border-border p-3">
              <div className="flex items-center gap-3">
                <Avatar className="h-9 w-9">
                  <AvatarFallback className="text-xs">{(f.name || "?").slice(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
                <span className="font-medium">{f.name || "Usuário"}</span>
              </div>
              <Button size="sm" variant="ghost" className="text-destructive" onClick={() => removeFriend.mutate(f.friendshipId)}>
                Remover
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
