import { useRef, useState, useCallback, ReactNode } from "react";
import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

const THRESHOLD = 72;
const MAX_PULL = 100;

interface Props {
  onRefresh: () => Promise<void>;
  children: ReactNode;
}

export default function PullToRefresh({ onRefresh, children }: Props) {
  const [pullY, setPullY] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef(0);
  const pulling = useRef(false);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    // Only trigger if scrolled to top
    const el = (e.currentTarget as HTMLElement);
    if (el.scrollTop > 0) return;
    startY.current = e.touches[0].clientY;
    pulling.current = true;
  }, []);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (!pulling.current || refreshing) return;
    const delta = e.touches[0].clientY - startY.current;
    if (delta <= 0) { setPullY(0); return; }
    // Resistance effect
    const pull = Math.min(MAX_PULL, delta * 0.5);
    setPullY(pull);
  }, [refreshing]);

  const onTouchEnd = useCallback(async () => {
    if (!pulling.current) return;
    pulling.current = false;
    if (pullY >= THRESHOLD) {
      setRefreshing(true);
      setPullY(THRESHOLD);
      try { await onRefresh(); } finally {
        setRefreshing(false);
        setPullY(0);
      }
    } else {
      setPullY(0);
    }
  }, [pullY, onRefresh]);

  const progress = Math.min(1, pullY / THRESHOLD);
  const isReady = pullY >= THRESHOLD;

  return (
    <div
      className="relative overflow-y-auto h-full"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {/* Indicator */}
      <div
        className="absolute left-0 right-0 flex justify-center z-10 pointer-events-none transition-all duration-200"
        style={{ top: -40 + pullY, opacity: progress }}
      >
        <div className={cn(
          "flex h-9 w-9 items-center justify-center rounded-full shadow-md transition-colors",
          isReady ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground"
        )}>
          <RefreshCw
            className={cn("h-4 w-4 transition-transform", refreshing && "animate-spin")}
            style={{ transform: `rotate(${progress * 360}deg)` }}
          />
        </div>
      </div>

      {/* Content pushed down while pulling */}
      <div style={{ transform: `translateY(${pullY}px)`, transition: pullY === 0 ? "transform 0.3s ease" : "none" }}>
        {children}
      </div>
    </div>
  );
}
