import { useState, useRef, useEffect } from "react";
import { Send, Bot, User, Sparkles, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAIChat } from "@/hooks/useAIChat";
import { useExpenses, useBalances } from "@/hooks/useExpenses";
import { useFriends } from "@/hooks/useFriends";
import { cn } from "@/lib/utils";

const QUICK_QUESTIONS = [
  "Qual minha maior despesa esse mês?",
  "Quem me deve mais dinheiro?",
  "Quanto gastei em alimentação?",
  "Faça um resumo dos meus gastos",
  "Adicionar despesa: almoço R$50",
];

export default function Chat() {
  const { messages, sendMessage, isLoading, clearMessages } = useAIChat();
  const { expensesQuery } = useExpenses();
  const balancesQuery = useBalances();
  const { acceptedFriends } = useFriends();
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const expenseCount = expensesQuery.data?.length ?? 0;
  const friendCount = acceptedFriends.length;
  const hasBalance = Object.keys(balancesQuery.data ?? {}).length > 0;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = () => {
    const text = input.trim();
    if (!text || isLoading) return;
    setInput("");
    sendMessage(text);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] md:h-[calc(100vh-3rem)]">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <Sparkles className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Assistente IA</h1>
            <p className="text-xs text-muted-foreground">
              {expenseCount} despesas · {friendCount} amigos{hasBalance ? " · saldos pendentes" : ""}
            </p>
          </div>
        </div>
        {messages.length > 0 && (
          <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground" onClick={clearMessages}>
            <Trash2 className="h-4 w-4" />
            Limpar
          </Button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-1">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-6 text-center px-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
              <Bot className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground mb-1">Como posso ajudar?</h2>
              <p className="text-sm text-muted-foreground max-w-xs">
                Pergunte sobre suas despesas, saldos ou peça pra eu registrar uma despesa pra você.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 justify-center max-w-sm">
              {QUICK_QUESTIONS.map((q) => (
                <button
                  key={q}
                  onClick={() => sendMessage(q)}
                  className="text-xs px-3 py-1.5 rounded-full border border-border bg-card hover:bg-accent hover:text-foreground text-muted-foreground transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={cn("flex gap-3", msg.role === "user" ? "flex-row-reverse" : "flex-row")}
            >
              {/* Avatar */}
              <div
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                  msg.role === "user" ? "bg-primary" : "bg-muted"
                )}
              >
                {msg.role === "user" ? (
                  <User className="h-4 w-4 text-primary-foreground" />
                ) : (
                  <Bot className="h-4 w-4 text-muted-foreground" />
                )}
              </div>

              {/* Bubble */}
              <div
                className={cn(
                  "max-w-[80%] rounded-2xl px-4 py-2.5 text-sm",
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground rounded-tr-sm"
                    : "bg-card border border-border text-foreground rounded-tl-sm"
                )}
              >
                {msg.isLoading ? (
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground text-xs italic">
                      {msg.content || "Pensando..."}
                    </span>
                    <span className="flex gap-1">
                      {[0, 1, 2].map((i) => (
                        <span
                          key={i}
                          className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce"
                          style={{ animationDelay: `${i * 0.15}s` }}
                        />
                      ))}
                    </span>
                  </div>
                ) : (
                  <div className="whitespace-pre-wrap leading-relaxed">{msg.content}</div>
                )}
              </div>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Quick questions (after first message) */}
      {messages.length > 0 && !isLoading && (
        <div className="flex gap-2 overflow-x-auto pb-2 pt-2 scrollbar-none">
          {QUICK_QUESTIONS.slice(0, 3).map((q) => (
            <button
              key={q}
              onClick={() => sendMessage(q)}
              className="shrink-0 text-xs px-3 py-1.5 rounded-full border border-border bg-card hover:bg-accent text-muted-foreground transition-colors"
            >
              {q}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="flex gap-2 pt-3 border-t border-border mt-2">
        <Textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Pergunte sobre suas despesas ou peça pra registrar uma..."
          className="min-h-[44px] max-h-32 resize-none bg-card border-border"
          rows={1}
          disabled={isLoading}
        />
        <Button
          onClick={handleSend}
          disabled={!input.trim() || isLoading}
          size="icon"
          className="shrink-0 h-11 w-11"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
