import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { messages, context } = await req.json();
    const { expenses = [], balances = {}, friends = [], userName = "Usuário", userId = "" } = context;

    const today = new Date().toLocaleDateString("pt-BR");

    // Format expenses (last 50)
    const expensesText =
      expenses.length === 0
        ? "Nenhuma despesa registrada ainda."
        : expenses
            .slice(0, 50)
            .map((e: any) => {
              const paidByName =
                e.paid_by === userId
                  ? "você"
                  : e.expense_participants?.find((p: any) => p.user_id === e.paid_by)?.profiles?.name ?? "outro";
              const parts = (e.expense_participants ?? [])
                .map(
                  (p: any) =>
                    `${p.profiles?.name ?? (p.user_id === userId ? "você" : "?")} R$${Number(p.amount_due).toFixed(2)}`
                )
                .join(", ");
              return `• ${e.expense_date} | ${e.description} (${e.category}) | Total: R$${Number(e.total_amount).toFixed(2)} | Pago por: ${paidByName} | Divisão: [${parts}]`;
            })
            .join("\n");

    // Format balances
    const balancesText =
      Object.keys(balances).length === 0
        ? "Sem saldos pendentes."
        : Object.entries(balances)
            .map(([friendId, amount]: [string, any]) => {
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

    const systemPrompt = `Você é o assistente financeiro do SplitEasy, um app de divisão de despesas.
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

    const tools = [
      {
        name: "create_expense",
        description:
          "Registra uma nova despesa no sistema. Use quando o usuário pedir para adicionar, registrar ou lançar uma despesa.",
        input_schema: {
          type: "object",
          properties: {
            description: {
              type: "string",
              description: "Nome/descrição da despesa",
            },
            total_amount: {
              type: "number",
              description: "Valor total em reais",
            },
            category: {
              type: "string",
              enum: ["alimentação", "transporte", "moradia", "lazer", "saúde", "educação", "compras", "outros"],
              description: "Categoria da despesa",
            },
            expense_date: {
              type: "string",
              description: "Data no formato YYYY-MM-DD",
            },
            participants: {
              type: "array",
              description:
                "Participantes da despesa incluindo o próprio usuário. Se não informado, a despesa é somente do usuário.",
              items: {
                type: "object",
                properties: {
                  user_id: { type: "string", description: "ID do participante" },
                  amount_due: { type: "number", description: "Valor que esse participante deve pagar" },
                  split_type: {
                    type: "string",
                    enum: ["equal", "exact", "percentage"],
                    description: "Tipo de divisão",
                  },
                },
                required: ["user_id", "amount_due", "split_type"],
              },
            },
          },
          required: ["description", "total_amount", "category", "expense_date"],
        },
      },
    ];

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY não configurada nas secrets do Supabase.");

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-opus-4-6",
        max_tokens: 2048,
        system: systemPrompt,
        tools,
        messages,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Anthropic API: ${errText}`);
    }

    const data = await response.json();

    // Tool use: Claude wants to create an expense
    if (data.stop_reason === "tool_use") {
      const toolUseBlock = data.content.find((b: any) => b.type === "tool_use");
      const textBlock = data.content.find((b: any) => b.type === "text");

      return new Response(
        JSON.stringify({
          type: "tool_call",
          tool_name: toolUseBlock.name,
          tool_use_id: toolUseBlock.id,
          tool_input: toolUseBlock.input,
          text: textBlock?.text ?? "",
          assistant_content: data.content,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Normal text response
    const textContent = data.content.find((b: any) => b.type === "text");
    return new Response(
      JSON.stringify({
        type: "text",
        text: textContent?.text ?? "",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
