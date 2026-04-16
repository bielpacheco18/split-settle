import { useState, useEffect } from "react";
import { X, Share, Plus } from "lucide-react";

function useIOSInstallPrompt() {
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const isInStandaloneMode =
    ("standalone" in navigator && (navigator as any).standalone === true) ||
    window.matchMedia("(display-mode: standalone)").matches;
  const isSafari =
    /safari/i.test(navigator.userAgent) && !/chrome|crios|fxios/i.test(navigator.userAgent);

  return isIOS && isSafari && !isInStandaloneMode;
}

function useAndroidInstallPrompt() {
  const [prompt, setPrompt] = useState<Event | null>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  return prompt as any;
}

const DISMISSED_KEY = "pwa-banner-dismissed";

export default function PWAInstallBanner() {
  const [visible, setVisible] = useState(false);
  const showIOS = useIOSInstallPrompt();
  const androidPrompt = useAndroidInstallPrompt();

  useEffect(() => {
    if (sessionStorage.getItem(DISMISSED_KEY)) return;
    if (showIOS || androidPrompt) setVisible(true);
  }, [showIOS, androidPrompt]);

  const dismiss = () => {
    sessionStorage.setItem(DISMISSED_KEY, "1");
    setVisible(false);
  };

  const installAndroid = async () => {
    if (!androidPrompt) return;
    androidPrompt.prompt();
    await androidPrompt.userChoice;
    dismiss();
  };

  if (!visible) return null;

  if (showIOS) {
    return (
      <div className="fixed bottom-20 left-4 right-4 z-50 rounded-2xl border border-border bg-card p-4 shadow-lg">
        <button
          onClick={dismiss}
          className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary">
            <span className="text-lg font-bold text-primary-foreground">S</span>
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">Instalar SplitEasy</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Toque em{" "}
              <span className="inline-flex items-center gap-0.5 font-medium text-foreground">
                <Share className="h-3 w-3" /> Compartilhar
              </span>{" "}
              e depois em{" "}
              <span className="inline-flex items-center gap-0.5 font-medium text-foreground">
                <Plus className="h-3 w-3" /> Adicionar à Tela de Início
              </span>
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed bottom-20 left-4 right-4 z-50 rounded-2xl border border-border bg-card p-4 shadow-lg">
      <button
        onClick={dismiss}
        className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
      >
        <X className="h-4 w-4" />
      </button>
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary">
          <span className="text-lg font-bold text-primary-foreground">S</span>
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-foreground">Instalar SplitEasy</p>
          <p className="text-xs text-muted-foreground">Acesso rápido direto da tela inicial</p>
        </div>
        <button
          onClick={installAndroid}
          className="shrink-0 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
        >
          Instalar
        </button>
      </div>
    </div>
  );
}
