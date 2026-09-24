# SplitEasy — Divisão de Despesas

Aplicativo (PWA) para gerenciar contas compartilhadas e dividir despesas com amigos e grupos, com assistente de IA, leitura de comprovantes e análise estatística dos gastos.

## Funcionalidades

- Cadastro e login, perfil com avatar
- Amigos (busca por email) e grupos
- Despesas com divisão igual, por valor exato ou por porcentagem
- Saldos, acertos de contas, histórico e feed de atividade
- Reações em despesas e notificações push
- Relatórios com gráficos e exportação em PDF
- **Assistente de IA** no chat, **leitura de comprovante** por foto e **insights estatísticos**, detalhados abaixo

## IA e Data Science

### 1. Assistente financeiro (LLM com function calling)
`src/hooks/useAIChat.ts` → edge function `supabase/functions/ai-chat`

- A cada mensagem, o app envia como contexto as últimas despesas do usuário (valor, categoria, quem pagou e a divisão), os saldos com cada amigo e a lista de amigos. A edge function monta o prompt de sistema com esses dados.
- Modelo: `openai/gpt-oss-120b`, via API da Groq.
- O modelo tem a ferramenta `create_expense`. Quando o usuário diz *"lança 90 reais de pizza dividido com o João"*, ele devolve uma chamada estruturada (descrição, valor, categoria, data e participantes). O app grava a despesa no Supabase (protegida por RLS) e devolve o resultado ao modelo, que confirma ao usuário.

### 2. Leitura de comprovante (modelo de visão)
`src/pages/AddExpense.tsx` → edge function `ai-chat` (modo `receipt`)

- A foto da nota vai para um modelo multimodal (`qwen/qwen3.8-27b`), que devolve estabelecimento, valor, categoria e data em JSON.
- A edge function valida a saída (categoria dentro da lista, valor positivo, data no formato `YYYY-MM-DD`) antes de preencher o formulário. O usuário revisa e salva.

### 3. Insights: previsão e detecção de anomalias (estatística)
`src/lib/analytics.ts`, com testes em `src/lib/analytics.test.ts` e exibição em `src/pages/Reports.tsx`

Funções puras, sem LLM:

- **Previsão do total do mês** (`forecastMonth`)
  - *Run rate*: gasto até hoje ÷ dias decorridos × dias do mês.
  - *Tendência*: regressão linear por mínimos quadrados sobre os totais dos meses anteriores (meses sem gasto contam como zero), com R².
  - As duas projeções são combinadas com peso `w = dias decorridos / dias do mês`: no início do mês prevalece a tendência, no fim prevalece o que já foi gasto.
  - Intervalo de ~95%: `±1,96 × erro residual × (1 − w)`, que diminui conforme o mês avança.
- **Despesas atípicas** (`detectAnomalies`): z-score modificado de Iglewicz & Hoaglin por categoria, `(x − mediana) / (MAD / 0,6745)`, com limiar de 3,5. Mediana e MAD são robustas a outliers, então a própria anomalia não distorce a referência.
- **Categorias acima do padrão** (`categoryDeviations`): o gasto do mês, projetado para o mês inteiro, é comparado com a média e o desvio padrão dos meses anteriores (z > 2).

## Arquitetura

- **Frontend:** React + TypeScript + Vite, shadcn/ui, Tailwind CSS, Framer Motion, TanStack Query, Recharts
- **Backend:** Supabase (Auth, PostgreSQL com Row Level Security, Realtime, Storage e Edge Functions)
- **IA:** Groq (LLM e visão), chamada apenas pela edge function. A chave nunca vai para o navegador.
- **PWA:** vite-plugin-pwa (instalável no celular) com Web Push

## Rodando localmente

```sh
npm install
cp .env.example .env   # preencha com as credenciais do Supabase
npm run dev
```

### Supabase

```sh
supabase link --project-ref <project-id>
supabase db push                                  # aplica as migrations
supabase secrets set GROQ_API_KEY=gsk_...         # chave da IA (só no servidor)
supabase functions deploy ai-chat
supabase functions deploy send-push               # precisa de VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY
```

## Variáveis de ambiente (frontend)

| Variável | Descrição |
|---|---|
| `VITE_SUPABASE_URL` | URL do projeto Supabase |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Chave anon (pública; o acesso é controlado por RLS) |
| `VITE_VAPID_PUBLIC_KEY` | Chave pública VAPID para notificações push |

## Scripts

| Comando | Descrição |
|---|---|
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` | Build de produção |
| `npm run preview` | Preview do build |
| `npm test` | Testes (Vitest) |
| `npm run lint` | ESLint |
