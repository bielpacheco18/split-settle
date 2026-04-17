import { REACTION_EMOJIS, ReactionsMap } from "@/hooks/useReactions";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

interface Props {
  expenseId: string;
  reactions: ReactionsMap;
  onToggle: (expenseId: string, emoji: string) => void;
  disabled?: boolean;
}

export default function ExpenseReactions({ expenseId, reactions, onToggle, disabled }: Props) {
  const { user } = useAuth();

  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {REACTION_EMOJIS.map((emoji) => {
        const users = reactions[emoji] ?? [];
        const iMine = users.some((u) => u.user_id === user?.id);
        const count = users.length;

        return (
          <button
            key={emoji}
            disabled={disabled}
            onClick={() => onToggle(expenseId, emoji)}
            title={users.map((u) => u.name).join(", ") || emoji}
            className={cn(
              "flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition-all select-none",
              iMine
                ? "border-primary bg-primary/10 text-primary font-semibold"
                : count > 0
                ? "border-border bg-muted/60 text-foreground"
                : "border-border/50 bg-transparent text-muted-foreground hover:bg-muted/40 hover:border-border"
            )}
          >
            <span>{emoji}</span>
            {count > 0 && <span>{count}</span>}
          </button>
        );
      })}
    </div>
  );
}
