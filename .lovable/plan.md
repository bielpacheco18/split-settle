

## SplitEasy — Gerenciamento de Contas Compartilhadas

### Visão Geral
App de divisão de despesas com tema escuro, autenticação de usuários, e divisão flexível de gastos entre amigos em um grupo.

---

### 1. Autenticação
- Tela de login/cadastro com email e senha
- Perfil básico do usuário (nome e avatar)
- Sessão persistente para acesso em qualquer dispositivo

### 2. Dashboard Principal
- Resumo do saldo: quanto você deve e quanto te devem
- Lista de amigos com saldos individuais (positivo/negativo)
- Botão rápido para adicionar nova despesa
- Design escuro com cards e cores de destaque para valores

### 3. Adicionar Amigos
- Buscar e adicionar amigos por email
- Ver lista de amigos vinculados
- Remover amigos quando necessário

### 4. Registrar Despesas
- Formulário para: descrição, valor total, data, quem pagou
- Seleção de participantes (quais amigos fazem parte)
- **Divisão flexível**: igual, por porcentagem, ou por valores exatos
- Visualização em tempo real de quanto cada pessoa deve

### 5. Cálculo "Quem Deve para Quem"
- Algoritmo inteligente que simplifica as dívidas (minimiza o número de transferências)
- Tela clara mostrando: "Fulano deve R$X para Ciclano"
- Botão para marcar dívida como paga/quitada

### 6. Histórico de Transações
- Lista cronológica de todas as despesas registradas
- Filtros por data e por pessoa
- Detalhes de cada despesa (quem pagou, como foi dividido)
- Indicador de despesas já quitadas vs pendentes

### 7. Relatórios
- Resumo mensal de gastos
- Gráficos de categorias de despesas (usando Recharts)
- Balanço geral por amigo ao longo do tempo
- Exportação simples dos dados

### 8. Design & Responsividade
- Tema escuro como padrão
- Layout mobile-first, responsivo para desktop
- Navegação por barra inferior no mobile, sidebar no desktop
- Animações suaves e feedback visual claro

### 9. Backend (Lovable Cloud + Supabase)
- Banco de dados para: usuários, amizades, despesas, participantes, pagamentos
- Row-Level Security para que cada usuário veja apenas seus dados
- Edge functions para o cálculo de simplificação de dívidas

