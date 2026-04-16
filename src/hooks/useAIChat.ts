import { useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useExpenses, useBalances } from "@/hooks/useExpenses";
import { useFriends } from "@/hooks/useFriends";
import { useProfile } from "@/hooks/useProfile";
import { useQueryClient } from "@tanstack/react-query";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  isLoading?: boolean;
}

// OpenAI-compatible message format (used by Groq)
interface ApiMessage {
  role: "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: any[];
  tool_call_id?: string;
  name?: string;
}

// Tools in OpenAI function-calling format
const TOOLS = [
  {
    type: "function",
    function: {
      name: "create_expense",
      description:
        "Registra uma nova despesa no sistema. Use quando o usuário pedir para adicionar, registrar ou lançar uma despesa.",
      parameters: {
        type: "object",
        properties: {
          description: { type: "string", description: "Nome/descrição da despesa" },
          total_amount: { type: "number", description: "Valor total em reais" },
          category: {
            type: "string",
            enum: ["alimentação", "transporte", "moradia", "lazer", "saúde", "educação", "compras", "outros"],
            description: "Categoria da despesa",
          },
          expense_date: { type: "string", description: "Data no formato YYYY-MM-DD" },
          participants: {
            type: "array",
            description: "Participantes para dividir a despesa. Se omitido, só o usuário.",
            items: {
              type: "object",
              properties: {
                user_id: { type: "string" },
                amount_due: { type: "number" },
                split_type: { type: "string", enum: ["equal", "exact", "percentage"] },
              },
              required: ["user_id", "amount_due", "split_type"],
            },
          },
        },
        required: ["description", "total_amount", "category", "expense_date"],
      },
    },
  },
];

function buildSystemPrompt(
  userName: string,
  userId: string,
  expenses: any[],
  balances: Record<string, number>,
  friends: any[]
) {
  const today = new Date().toLocaleDateString("pt-BR");

  const expensesText =
    expenses.length === 0
      ? "Nenhuma despesa registrada ainda."
      : expenses
          .slice(0, 50)
          .map((e) => {
            const paidByName =
              e.paid_by === userId
                ? "você"
                : (e.expense_participants?.find((p: any) => p.user_id === e.paid_by)?.profiles?.name ?? "outro");
            const parts = (e.expense_participants ?? [])
              .map(
                (p: any) =>
                  `${p.profiles?.name ?? (p.user_id === userId ? "você" : "?")} R$${Number(p.amount_due).toFixed(2)}`
              )
              .join(", ");
            return `• ${e.expense_date} | ${e.description} (${e.category}) | Total: R$${Number(e.total_amount).toFixed(2)} | Pago por: ${paidByName} | Divisão: [${parts}]`;
          })
          .join("\n");

  const balancesText =
    Object.keys(balances).length === 0
      ? "Sem saldos pendentes."
      : Object.entries(balances)
          .map(([friendId, amount]) => {
            const friend = friends.find((f: any) => f.id === friendId);
            const name = friend?.name ?? "Desconhecido";
            if (amount > 0.01) return `• ${name} te deve R$${Math.abs(amount).toFixed(2)}`;
            if (amount < -0.01) return `• Você deve R$${Math.abs(amount).toFixed(2)} para ${name}`;
            return null;
          })
          .filter(Boolean)
          .join("\n") || "Contas em dia!";

  const friendsText =
    friends.length === 0
      ? "Nenhum amigo cadastrado."
      : friends.map((f: any) => `• ${f.name} (id: ${f.id})`).join("\n");

  return `Você é o assistente financeiro do SplitEasy, um app de divisão de despesas.
Usuário: ${userName} (id: ${userId})
Data de hoje: ${today}

═══ DESPESAS (${expenses.length} registradas) ═══
${expensesText}

═══ SALDOS COM AMIGOS ═══
${balancesText}

═══ AMIGOS ═══
${friendsText}

Você pode:
1. Responder perguntas sobre despesas, saldos e padrões de gasto
2. Fazer análises e dar insights financeiros
3. Registrar novas despesas usando a ferramenta create_expense

Regras:
- Responda sempre em português brasileiro, de forma amigável e objetiva
- Ao registrar despesas, use a data de hoje se não especificada
- Para dividir com amigos, use os IDs da lista acima
- Confirme os dados antes de registrar se houver ambiguidade`;
}

async function callGroq(messages: ApiMessage[], systemPrompt: string) {
  const apiKey = import.meta.env.VITE_GROQ_API_KEY;
  if (!apiKey) {
    throw new Error(
      "Chave Groq não configurada. Adicione VITE_GROQ_API_KEY no arquivo .env e reinicie o servidor."
    );
  }

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      max_tokens: 2048,
      messages: [{ role: "system", content: systemPrompt }, ...messages],
      tools: TOOLS,
      tool_choice: "auto",
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Groq API: ${err}`);
  }

  return res.json();
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

      const systemPrompt = buildSystemPrompt(
        profileQuery.data?.name ?? user.email ?? "Usuário",
        user.id,
        expensesQuery.data ?? [],
        balancesQuery.data ?? {},
        acceptedFriends
      );

      try {
        const history: ApiMessage[] = [...apiHistoryRef.current, { role: "user", content: text }];
        const data = await callGroq(history, systemPrompt);

        const choice = data.choices?.[0];
        const assistantMsg = choice?.message;

        if (choice?.finish_reason === "tool_calls" && assistantMsg?.tool_calls?.length > 0) {
          const toolCall = assistantMsg.tool_calls[0];
          const input = JSON.parse(toolCall.function.arguments);

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
              participants.map((p: any) => ({
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
          } catch (err: any) {
            toolResult = `Erro ao registrar: ${err.message}`;
          }

          // Continue conversation with tool result
          const continuedHistory: ApiMessage[] = [
            ...history,
            { role: "assistant", content: assistantMsg.content ?? null, tool_calls: assistantMsg.tool_calls },
            { role: "tool", content: toolResult, tool_call_id: toolCall.id, name: toolCall.function.name },
          ];

          const finalData = await callGroq(continuedHistory, systemPrompt);
          const finalText = finalData.choices?.[0]?.message?.content ?? "Despesa registrada!";

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
      } catch (err: any) {
        updateMessage(loadingId, {
          content: `Erro: ${err.message ?? "Não foi possível conectar ao assistente."}`,
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
