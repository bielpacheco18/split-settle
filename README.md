# SplitEasy — Divisão de Despesas

Aplicativo para gerenciar contas compartilhadas e dividir despesas com amigos.

## Stack

- **Frontend:** React + TypeScript + Vite
- **UI:** shadcn/ui + Tailwind CSS + Framer Motion
- **Backend:** Supabase (Auth + PostgreSQL + Realtime)
- **PWA:** vite-plugin-pwa (instalável no celular)

## Rodando localmente

```sh
# 1. Instalar dependências
npm install

# 2. Configurar variáveis de ambiente
cp .env.example .env
# edite o .env com suas credenciais do Supabase

# 3. Iniciar servidor de desenvolvimento
npm run dev
```

## Variáveis de ambiente

```env
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sua-anon-key
```

## Scripts

| Comando | Descrição |
|---|---|
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` | Build de produção |
| `npm run preview` | Preview do build |
| `npm test` | Rodar testes |
