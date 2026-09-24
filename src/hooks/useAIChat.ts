import { useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useExpenses, useBalances } from "@/hooks/useExpenses";
import { useFriends } from "@/hooks/useFriends";
import { useProfile } from "@/hooks/useProfile";
import { useQueryClient } from "@tanstack/react-query";
import { chatCompletion, ToolCall } from "@/lib/ai";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  isLoading?: boolean;
}

// Formato de mensagem compatível com a API da OpenAI (usado pela Groq)
interface ApiMessage {
  role: "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
  name?: string;
}

interface CreateExpenseInput {
  description: string;
  total_amount: number;
  category: string;
  expense_date: string;
  participants?: { user_id: string; amount_due: number; split_type: "equal" | "exact" | "percentage" }[];
}

export function useAIChat() {
  const { user } = useAuth();
  const { expensesQuery } = useExpenses();
  const balancesQuery = useBalances();
  const { acceptedFriends } = useFriends();
  const profileQuery = useProfile();
  const queryClient = useQueryClient();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const apiHistoryRef = useRef<ApiMessage[]>([]);

  const addMessage = useCallback((msg: Omit<ChatMessage, "id">) => {
    const id = crypto.randomUUID();
    setMessages((prev) => [...prev, { ...msg, id }]);
    return id;
  }, []);

  const updateMessage = useCallback((id: string, updates: Partial<ChatMessage>) => {
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, ...updates } : m)));
  }, []);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!user || isLoading) return;

      addMessage({ role: "user", content: text });
      const loadingId = addMessage({ role: "assistant", content: "", isLoading: true });
      setIsLoading(true);

      // O prompt de sistema é montado na edge function a partir deste contexto
      const context = {
        userName: profileQuery.data?.name ?? user.email ?? "Usuário",
        userId: user.id,
        expenses: expensesQuery.data ?? [],
        balances: balancesQuery.data ?? {},
        friends: acceptedFriends.map((f) => ({ id: f.id, name: f.name })),
      };

      try {
        const history: ApiMessage[] = [...apiHistoryRef.current, { role: "user", content: text }];
        const data = await chatCompletion(history, context);

        const assistantMsg = data.message;

        if (data.finish_reason === "tool_calls" && assistantMsg?.tool_calls?.length) {
          const toolCall = assistantMsg.tool_calls[0];
          const input = JSON.parse(toolCall.function.arguments) as CreateExpenseInput;

          updateMessage(loadingId, { content: "_Registrando despesa..._", isLoading: true });

          let toolResult = "";
          try {
            const participants = input.participants ?? [
              { user_id: user.id, amount_due: input.total_amount, split_type: "equal" },
            ];

            const { data: expense, error: expErr } = await supabase
              .from("expenses")
              .insert({
                description: input.description,
                total_amount: input.total_amount,
                category: input.category,
                expense_date: input.expense_date,
                paid_by: user.id,
              })
              .select()
              .single();

            if (expErr) throw expErr;

            const { error: partErr } = await supabase.from("expense_participants").insert(
              participants.map((p) => ({
                expense_id: expense.id,
                user_id: p.user_id,
                amount_due: p.amount_due,
                split_type: p.split_type,
              }))
            );

            if (partErr) throw partErr;

            queryClient.invalidateQueries({ queryKey: ["expenses"] });
            queryClient.invalidateQueries({ queryKey: ["balances"] });
            toolResult = `Despesa registrada com sucesso! ID: ${expense.id}`;
          } catch (err) {
            toolResult = `Erro ao registrar: ${err instanceof Error ? err.message : String(err)}`;
          }

          // Continue conversation with tool result
          const continuedHistory: ApiMessage[] = [
            ...history,
            { role: "assistant", content: assistantMsg.content ?? null, tool_calls: assistantMsg.tool_calls },
            { role: "tool", content: toolResult, tool_call_id: toolCall.id, name: toolCall.function.name },
          ];

          const finalData = await chatCompletion(continuedHistory, context);
          const finalText = finalData.message?.content ?? "Despesa registrada!";

          updateMessage(loadingId, { content: finalText, isLoading: false });
          apiHistoryRef.current = [
            ...continuedHistory,
            { role: "assistant", content: finalText },
          ];
        } else {
          const replyText = assistantMsg?.content ?? "Sem resposta.";
          updateMessage(loadingId, { content: replyText, isLoading: false });
          apiHistoryRef.current = [...history, { role: "assistant", content: replyText }];
        }
      } catch (err) {
        updateMessage(loadingId, {
          content: `Erro: ${err instanceof Error ? err.message : "Não foi possível conectar ao assistente."}`,
          isLoading: false,
        });
      } finally {
        setIsLoading(false);
      }
    },
    [user, isLoading, expensesQuery.data, balancesQuery.data, acceptedFriends, profileQuery.data, addMessage, updateMessage, queryClient]
  );

  const clearMessages = useCallback(() => {
    setMessages([]);
    apiHistoryRef.current = [];
  }, []);

  return { messages, sendMessage, isLoading, clearMessages };
}
