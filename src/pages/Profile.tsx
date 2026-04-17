import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { User, LogOut, KeyRound, Bell, BellOff } from "lucide-react";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export default function Profile() {
  const { user, signOut } = useAuth();
  const { data: profile, updateProfile } = useProfile();
  const { toast } = useToast();

  const { permission, loading: pushLoading, subscribe, unsubscribe } = usePushNotifications();
  const [name, setName] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  useEffect(() => {
    if (profile?.name) setName(profile.name);
  }, [profile?.name]);

  const handleSaveName = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    updateProfile.mutate({ name: name.trim() });
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      toast({ title: "Senha muito curta", description: "Mínimo 6 caracteres.", variant: "destructive" });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: "Senhas não coincidem", variant: "destructive" });
      return;
    }
    setChangingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setChangingPassword(false);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Senha alterada!" });
      setNewPassword("");
      setConfirmPassword("");
    }
  };

  const initials = (profile?.name || user?.email || "?").slice(0, 2).toUpperCase();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Perfil</h1>

      {/* Avatar + info */}
      <Card>
        <CardContent className="flex items-center gap-4 p-5">
          <Avatar className="h-16 w-16">
            <AvatarFallback className="text-xl">{initials}</AvatarFallback>
          </Avatar>
          <div>
            <p className="text-lg font-semibold">{profile?.name || "—"}</p>
            <p className="text-sm text-muted-foreground">{user?.email}</p>
          </div>
        </CardContent>
      </Card>

      {/* Edit name */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <User className="h-5 w-5" /> Dados pessoais
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSaveName} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Seu nome"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={user?.email || ""} disabled className="text-muted-foreground" />
            </div>
            <Button type="submit" disabled={updateProfile.isPending || name === profile?.name}>
              {updateProfile.isPending ? "Salvando..." : "Salvar alterações"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Change password */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <KeyRound className="h-5 w-5" /> Alterar senha
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="newPassword">Nova senha</Label>
              <Input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••"
                minLength={6}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmar nova senha</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                minLength={6}
                required
              />
            </div>
            <Button type="submit" variant="outline" disabled={changingPassword}>
              {changingPassword ? "Alterando..." : "Alterar senha"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Push notifications */}
      {permission !== "unsupported" && import.meta.env.VITE_VAPID_PUBLIC_KEY && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Bell className="h-5 w-5" /> Notificações
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {permission === "granted"
                ? "Notificações ativas. Você será avisado quando alguém adicionar uma despesa com você ou fizer um pagamento."
                : permission === "denied"
                ? "Notificações bloqueadas pelo navegador. Habilite nas configurações do navegador."
                : "Ative para ser avisado sobre novas despesas e pagamentos."}
            </p>
            {permission !== "denied" && (
              permission === "granted" ? (
                <Button variant="outline" onClick={unsubscribe} disabled={pushLoading} className="gap-2">
                  <BellOff className="h-4 w-4" />
                  {pushLoading ? "Desativando..." : "Desativar notificações"}
                </Button>
              ) : (
                <Button onClick={subscribe} disabled={pushLoading} className="gap-2">
                  <Bell className="h-4 w-4" />
                  {pushLoading ? "Ativando..." : "Ativar notificações"}
                </Button>
              )
            )}
          </CardContent>
        </Card>
      )}

      <Separator />

      <Button variant="ghost" className="w-full justify-start gap-3 text-destructive hover:text-destructive" onClick={signOut}>
        <LogOut className="h-5 w-5" />
        Sair da conta
      </Button>
    </div>
  );
}
