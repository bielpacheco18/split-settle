import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Mensagem legível de um erro desconhecido (Error, PostgrestError do Supabase etc.). */
export function errorMessage(err: unknown, fallback = "Erro inesperado.") {
  if (err && typeof err === "object" && "message" in err && typeof err.message === "string") return err.message;
  return fallback;
}
