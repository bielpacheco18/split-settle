// Proxy de IA: mantém a chave da Groq no servidor e monta o prompt com os dados do usuário.
// Dois modos:
//   - "chat":    assistente financeiro com function calling (create_expense)
//   - "receipt": extração de dados de comprovante com modelo de visão
// A função exige JWT válido (verify_jwt padrão do Supabase), então só usuários logados chamam.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const CHAT_MODEL = "openai/gpt-oss-120b";
const VISION_MODEL = "qwen/qwen3.8-27b";
const MAX_IMAGE_BASE64 = 6_000_000; // ~4.5MB de imagem
const MAX_HISTORY = 30;

const CATEGORIES = ["alimentação", "transporte", "moradia", "lazer", "saúde", "educação", "compras", "outros"];

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Participant {
  user_id: string;
  amount_due: number | string;
  profiles?: { name?: string } | null;
}

interface ExpenseContext {
  expense_date: string;
  description: string;
  category: string;
  total_amount: number | string;
  paid_by: string;
  expense_participants?: Participant[];
}

interface Friend {
  id: string;
  name: string;
}

interface ChatContext {
  expenses?: ExpenseContext[];
  balances?: Record<string, number>;
  friends?: Friend[];
  userName?: string;
  userId?: string;
}

interface ApiMessage {
  role: "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: unknown[];
  tool_call_id?: string;
  name?: string;
}

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
          category: { type: "string", enum: CATEGORIES, description: "Categoria da despesa" },
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

function buildSystemPrompt({ expenses = [], balances = {}, friends = [], userName = "Usuário", userId = "" }: ChatContext) {
  const today = new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });

  const expensesText =
    expenses.length === 0
      ? "Nenhuma despesa registrada ainda."
      : expenses
          .slice(0, 50)
          .map((e) => {
            const paidByName =
              e.paid_by === userId
                ? "você"
                : (e.expense_participants?.find((p) => p.user_id === e.paid_by)?.profiles?.name ?? "outro");
            const parts = (e.expense_participants ?? [])
              .map(
                (p) =>
                  `${p.profiles?.name ?? (p.user_id === userId ? "você" : "?")} R$${Number(p.amount_due).toFixed(2)}`
              )
              .join(", ");
            return `• ${e.expense_date} | ${e.description} (${e.category}) | Total: R$${Number(e.total_amount).toFixed(2)} | Pago por: ${paidByName} | Divisão: [${parts}]`;
          })
          .join("\n");

  const balancesText =
    Object.entries(balances)
      .map(([friendId, amount]) => {
        const name = friends.find((f) => f.id === friendId)?.name ?? "Desconhecido";
        if (amount > 0.01) return `• ${name} te deve R$${Math.abs(amount).toFixed(2)}`;
        if (amount < -0.01) return `• Você deve R$${Math.abs(amount).toFixed(2)} para ${name}`;
        return null;
      })
      .filter(Boolean)
      .join("\n") || "Contas em dia!";

  const friendsText =
    friends.length === 0 ? "Nenhum amigo cadastrado." : friends.map((f) => `• ${f.name} (id: ${f.id})`).join("\n");

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

async function callGroq(body: Record<string, unknown>) {
  const apiKey = Deno.env.get("GROQ_API_KEY");
  if (!apiKey) throw new Error("GROQ_API_KEY não configurada nas secrets do Supabase.");

  const res = await fetch(GROQ_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Groq API: ${await res.text()}`);
  return res.json();
}

async function handleChat(messages: ApiMessage[], context: ChatContext) {
  if (!Array.isArray(messages) || messages.length === 0) throw new Error("Mensagens ausentes.");
  // O cliente não pode injetar um prompt de sistema próprio.
  const history = messages.filter((m) => m.role !== ("system" as string)).slice(-MAX_HISTORY);

  const data = await callGroq({
    model: CHAT_MODEL,
    max_tokens: 2048,
    messages: [{ role: "system", content: buildSystemPrompt(context ?? {}) }, ...history],
    tools: TOOLS,
    tool_choice: "auto",
  });
  const choice = data.choices?.[0];
  return { message: choice?.message ?? null, finish_reason: choice?.finish_reason ?? null };
}

async function handleReceipt(image: string, mimeType: string) {
  if (typeof image !== "string" || !image) throw new Error("Imagem ausente.");
  if (image.length > MAX_IMAGE_BASE64) throw new Error("Imagem muito grande.");
  if (!/^image\/(png|jpe?g|webp|heic|heif)$/.test(mimeType)) throw new Error("Formato de imagem não suportado.");

  const data = await callGroq({
    model: VISION_MODEL,
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: [
          { type: "image_url", image_url: { url: `data:${mimeType};base64,${image}` } },
          {
            type: "text",
            text: `Analise este comprovante/nota fiscal e extraia as informações. Responda SOMENTE em JSON válido, sem markdown:
{"description":"nome do estabelecimento ou produto principal","total_amount":0.00,"category":"uma de: ${CATEGORIES.join("/")}","expense_date":"YYYY-MM-DD ou null se não visível"}`,
          },
        ],
      },
    ],
  });

  // Remove o bloco de raciocínio que alguns modelos emitem antes da resposta
  const text = String(data.choices?.[0]?.message?.content ?? "").replace(/<think>[\s\S]*?<\/think>/g, "");
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("IA não retornou JSON válido");
  const raw = JSON.parse(match[0]);

  // Valida e normaliza a saída do modelo antes de devolver ao cliente
  const amount = Number(raw.total_amount);
  return {
    description: typeof raw.description === "string" ? raw.description.slice(0, 200) : "",
    total_amount: Number.isFinite(amount) && amount > 0 ? Math.round(amount * 100) / 100 : null,
    category: CATEGORIES.includes(raw.category) ? raw.category : null,
    expense_date:
      typeof raw.expense_date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(raw.expense_date) ? raw.expense_date : null,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const result =
      body.mode === "receipt"
        ? await handleReceipt(body.image, body.mimeType)
        : await handleChat(body.messages, body.context);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
