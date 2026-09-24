// Cliente da edge function "ai-chat". A chave da Groq fica só no servidor.
import { FunctionsHttpError } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export interface ReceiptData {
  description: string;
  total_amount: number | null;
  category: string | null;
  expense_date: string | null;
}

export interface ToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

export interface AssistantMessage {
  role: "assistant";
  content: string | null;
  tool_calls?: ToolCall[];
}

export interface ChatResponse {
  message: AssistantMessage | null;
  finish_reason: string | null;
}

async function invokeAI<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke<T>("ai-chat", { body });
  if (error) {
    // Repassa a mensagem de erro devolvida pela função, quando houver
    if (error instanceof FunctionsHttpError) {
      const payload = await error.context.json().catch(() => null);
      throw new Error(payload?.error ?? error.message);
    }
    throw error;
  }
  return data as T;
}

export function extractReceiptData(image: string, mimeType: string) {
  return invokeAI<ReceiptData>({ mode: "receipt", image, mimeType });
}

export function chatCompletion(messages: unknown[], context: Record<string, unknown>) {
  return invokeAI<ChatResponse>({ mode: "chat", messages, context });
}
