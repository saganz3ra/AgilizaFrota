"use client";

import { auth } from "./firebase";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/api";

export class ApiError extends Error {
  status: number;
  codigo?: string;
  constructor(status: number, message: string, codigo?: string) {
    super(message);
    this.status = status;
    this.codigo = codigo;
  }
}

/**
 * Wrapper de fetch para a API. Injeta o ID token do Firebase no cabecalho
 * Authorization quando ha um usuario logado. Retorna o JSON tipado.
 * Erros de rede viram ApiError(0, ..., 'SEM_CONEXAO').
 */
export async function api<T>(caminho: string, opcoes: RequestInit = {}): Promise<T> {
  const headers = new Headers(opcoes.headers);
  headers.set("Content-Type", "application/json");

  const usuario = auth.currentUser;
  if (usuario) {
    const token = await usuario.getIdToken();
    headers.set("Authorization", `Bearer ${token}`);
  }

  let resp: Response;
  try {
    resp = await fetch(`${BASE_URL}${caminho}`, { ...opcoes, headers });
  } catch {
    throw new ApiError(
      0,
      "Não foi possível conectar à API. Verifique se o backend está rodando e a URL configurada.",
      "SEM_CONEXAO",
    );
  }

  let corpo: unknown = null;
  const texto = await resp.text();
  if (texto) {
    try {
      corpo = JSON.parse(texto);
    } catch {
      corpo = texto;
    }
  }

  if (!resp.ok) {
    const c = (corpo || {}) as { erro?: string; codigo?: string };
    throw new ApiError(resp.status, c.erro || `Erro ${resp.status}`, c.codigo);
  }

  return corpo as T;
}

/** URL absoluta de um caminho da API (util para EventSource/SSE). */
export function apiUrl(caminho: string): string {
  return `${BASE_URL}${caminho}`;
}
