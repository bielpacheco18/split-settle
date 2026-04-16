import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Wallet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Mode = "login" | "register" | "forgot";

export default function Auth() {
  const { user, loading } = useAuth();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { signIn, signUp } = useAuth();
  const { toast } = useToast();

  if (loading) return null;
  if (user) return <Navigate to="/" replace />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    if (mode === "forgot") {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth`,
      });
      if (error) {
        toast({ title: "Erro", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "Email enviado!", description: "Verifique sua caixa de entrada para redefinir a senha." });
        setMode("login");
        setEmail("");
      }
      setSubmitting(false);
      return;
    }

    if (mode === "login") {
      const { error } = await signIn(email, password);
      if (error) {
        toast({ title: "Erro ao entrar", description: error.message, variant: "destructive" });
      }
    } else {
      if (!name.trim()) {
        toast({ title: "Nome obrigatório", description: "Digite seu nome.", variant: "destructive" });
        setSubmitting(false);
        return;
      }
      const { error } = await signUp(email, password, name.trim());
      if (error) {
        toast({ title: "Erro ao cadastrar", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "Conta criada!", description: "Verifique seu email para confirmar o cadastro." });
      }
    }
    setSubmitting(false);
  };

  const titles: Record<Mode, string> = {
    login: "Entre na sua conta",
    register: "Crie sua conta",
    forgot: "Recuperar senha",
  };

  const buttonLabels: Record<Mode, string> = {
    login: "Entrar",
    register: "Criar conta",
    forgot: "Enviar email de recuperação",
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-primary">
            <Wallet className="h-7 w-7 text-primary-foreground" />
          </div>
          <CardTitle className="text-2xl">SplitEasy</CardTitle>
          <CardDescription>{titles[mode]}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "register" && (
              <div className="space-y-2">
                <Label htmlFor="name">Nome</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Seu nome" />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seu@email.com" required />
            </div>
            {mode !== "forgot" && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Senha</Label>
                  {mode === "login" && (
                    <button
                      type="button"
                      onClick={() => { setMode("forgot"); setPassword(""); }}
                      className="text-xs text-primary underline-offset-4 hover:underline"
                    >
                      Esqueceu a senha?
                    </button>
                  )}
                </div>
                <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required minLength={6} />
              </div>
            )}
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? "Carregando..." : buttonLabels[mode]}
            </Button>
          </form>

          <div className="mt-4 space-y-2 text-center text-sm text-muted-foreground">
            {mode === "forgot" ? (
              <p>
                Lembrou?{" "}
                <button onClick={() => setMode("login")} className="text-primary underline-offset-4 hover:underline">
                  Voltar ao login
                </button>
              </p>
            ) : (
              <p>
                {mode === "login" ? "Não tem conta?" : "Já tem conta?"}{" "}
                <button
                  onClick={() => setMode(mode === "login" ? "register" : "login")}
                  className="text-primary underline-offset-4 hover:underline"
                >
                  {mode === "login" ? "Cadastre-se" : "Entre"}
                </button>
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
