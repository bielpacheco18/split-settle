import { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useFriends } from "@/hooks/useFriends";
import { LayoutDashboard, Users, PlusCircle, History, BarChart3, LogOut, UserCircle, Bot } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { AnimatePresence } from "framer-motion";
import PageTransition from "@/components/PageTransition";

export default function AppLayout({ children }: { children: ReactNode }) {
  const { signOut } = useAuth();
  const location = useLocation();
  const isMobile = useIsMobile();
  const { pendingReceived } = useFriends();
  const pendingCount = pendingReceived.length;

  const navItems = [
    { to: "/", icon: LayoutDashboard, label: "Dashboard", badge: 0 },
    { to: "/friends", icon: Users, label: "Amigos", badge: pendingCount },
    { to: "/add-expense", icon: PlusCircle, label: "Despesa", badge: 0 },
    { to: "/history", icon: History, label: "Histórico", badge: 0 },
    { to: "/reports", icon: BarChart3, label: "Relatórios", badge: 0 },
    { to: "/chat", icon: Bot, label: "IA", badge: 0 },
    { to: "/profile", icon: UserCircle, label: "Perfil", badge: 0 },
  ];

  return (
    <div className="flex min-h-screen bg-background">
      {!isMobile && (
        <aside className="sticky top-0 flex h-screen w-60 flex-col border-r border-border bg-card p-4">
          <div className="mb-8 flex items-center gap-2 px-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
              <span className="text-lg font-bold text-primary-foreground">S</span>
            </div>
            <span className="text-lg font-bold text-foreground">SplitEasy</span>
          </div>
          <nav className="flex flex-1 flex-col gap-1">
            {navItems.map(({ to, icon: Icon, label, badge }) => (
              <Link
                key={to}
                to={to}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  location.pathname === to
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                )}
              >
                <div className="relative">
                  <Icon className="h-5 w-5" />
                  {badge > 0 && (
                    <span className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
                      {badge > 9 ? "9+" : badge}
                    </span>
                  )}
                </div>
                {label}
              </Link>
            ))}
          </nav>
          <Button variant="ghost" className="justify-start gap-3 text-muted-foreground hover:text-destructive" onClick={signOut}>
            <LogOut className="h-5 w-5" />
            Sair
          </Button>
        </aside>
      )}

      <main className={cn("flex-1", isMobile ? "pb-20" : "")}>
        <div className="mx-auto max-w-4xl p-4 md:p-6">
          <AnimatePresence mode="wait">
            <PageTransition key={location.pathname}>
              {children}
            </PageTransition>
          </AnimatePresence>
        </div>
      </main>

      {isMobile && (
        <nav className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around border-t border-border bg-card px-2 py-2">
          {navItems.map(({ to, icon: Icon, label, badge }) => (
            <Link
              key={to}
              to={to}
              className={cn(
                "flex flex-col items-center gap-0.5 rounded-lg px-3 py-1.5 text-xs transition-colors",
                location.pathname === to ? "text-primary" : "text-muted-foreground"
              )}
            >
              <div className="relative">
                <Icon className="h-5 w-5" />
                {badge > 0 && (
                  <span className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
                    {badge > 9 ? "9+" : badge}
                  </span>
                )}
              </div>
              <span>{label}</span>
            </Link>
          ))}
        </nav>
      )}
    </div>
  );
}
