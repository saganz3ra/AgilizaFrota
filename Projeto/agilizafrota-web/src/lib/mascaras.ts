"use client";

/**
 * Máscaras de entrada (formatação automática enquanto digita).
 *
 * Estas funções são de APRESENTAÇÃO: transformam o que o usuário digita num
 * formato legível (ex.: telefone → "(42) 99999-8888"). A validação da regra
 * fica em `lib/validacao.ts`, e a barreira real continua no backend.
 *
 * Cada máscara é idempotente: pode receber o texto já formatado (ao carregar
 * um valor salvo) que o resultado é o mesmo — ela trabalha só sobre os dígitos.
 */

/** Remove tudo que não for dígito. */
export function soDigitos(valor: string): string {
  return valor.replace(/\D/g, "");
}

/**
 * Telefone brasileiro, progressivo conforme digita:
 *   fixo    (10 díg.): (42) 3333-4444
 *   celular (11 díg.): (42) 99999-8888
 * Aceita no máximo 11 dígitos (DDD + 9).
 */
export function mascaraTelefone(valor: string): string {
  const d = soDigitos(valor).slice(0, 11);
  if (d.length === 0) return "";
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

/**
 * Data no formato DD/MM/AAAA, com as barras inseridas conforme digita.
 * Aceita no máximo 8 dígitos. A validação de data real (rejeitar 31/02) fica
 * em `dataValida`/`dataParaIso` em `lib/validacao.ts`.
 */
export function mascaraData(valor: string): string {
  const d = soDigitos(valor).slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
}
