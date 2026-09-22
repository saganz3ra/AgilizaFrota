"use client";

/**
 * Validação de campos no front — a CAMADA DE UX.
 *
 * Importante entender o papel disto: NÃO é a barreira de segurança. As regras
 * de verdade vivem no backend (schemas Zod em `validators/*` + constraints do
 * banco), e é lá que a integridade é garantida mesmo se alguém chamar a API
 * direto. Aqui só espelhamos um SUBCONJUNTO dessas regras — as baratas e
 * óbvias (obrigatório, formato, tamanho, faixa) — para dar feedback imediato
 * e evitar idas ao servidor à toa.
 *
 * As regras que o cliente não tem como checar (placa única, um turno aberto
 * por motorista, quilometragem não-retroativa, unidade existente/ativa) NÃO
 * são reimplementadas aqui: o front apenas trata o erro que o backend devolve,
 * pelo `codigo`. Isso evita o pior da duplicação — os dois lados divergirem.
 *
 * Cada validador devolve a mensagem de erro (string) ou `null` se o campo está
 * ok — assim dá para compor: `obrigatorio(v,"Nome") ?? tamanho(v,{...})`.
 */
import { useCallback, useState } from "react";

export type Erro = string | null;

/** Campo de texto obrigatório (ignora espaços em branco). */
export function obrigatorio(valor: string, nome: string): Erro {
  return valor.trim() ? null : `${nome} é obrigatório.`;
}

/** Comprimento de um texto. Só valida o que foi passado (min e/ou max). */
export function tamanho(
  valor: string,
  opts: { min?: number; max?: number; nome: string },
): Erro {
  const t = valor.trim();
  if (opts.min !== undefined && t.length < opts.min) {
    return `${opts.nome} deve ter ao menos ${opts.min} caractere(s).`;
  }
  if (opts.max !== undefined && t.length > opts.max) {
    return `${opts.nome} deve ter no máximo ${opts.max} caractere(s).`;
  }
  return null;
}

/** Formato de e-mail. Regex simples e suficiente para UX; o backend valida de verdade. */
export function email(valor: string): Erro {
  const t = valor.trim();
  if (!t) return "E-mail é obrigatório.";
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t) ? null : "E-mail inválido.";
}

/** Placa nos formatos antigo (ABC1234) e Mercosul (ABC1D23) — espelha o backend. */
export function placa(valor: string): Erro {
  const t = valor.trim().toUpperCase();
  if (!t) return "Placa é obrigatória.";
  return /^[A-Z]{3}[0-9][0-9A-Z][0-9]{2}$/.test(t)
    ? null
    : "Placa inválida (use ABC1234 ou ABC1D23).";
}

/**
 * Telefone brasileiro OPCIONAL. Valida pela contagem de dígitos (ignora a
 * máscara): 10 (fixo) ou 11 (celular). Vazio é válido.
 */
export function telefone(valor: string): Erro {
  const d = valor.replace(/\D/g, "");
  if (d.length === 0) return null;
  if (d.length < 10 || d.length > 11) {
    return "Telefone deve ter DDD + 8 ou 9 dígitos.";
  }
  return null;
}

/**
 * Converte uma data digitada "DD/MM/AAAA" em ISO 8601, ou null se estiver
 * vazia/incompleta/inválida. `fimDoDia` leva ao fim do dia (para o filtro
 * "Até" incluir o dia inteiro). A checagem dia/mês/ano rejeita datas que não
 * existem (ex.: 31/02, que um `new Date` ingênuo "rolaria" para março).
 */
export function dataParaIso(valor: string, opts: { fimDoDia?: boolean } = {}): string | null {
  const d = valor.replace(/\D/g, "");
  if (d.length !== 8) return null;
  const dia = Number(d.slice(0, 2));
  const mes = Number(d.slice(2, 4));
  const ano = Number(d.slice(4, 8));
  const fim = opts.fimDoDia === true;
  const data = new Date(ano, mes - 1, dia, fim ? 23 : 0, fim ? 59 : 0, fim ? 59 : 0, fim ? 999 : 0);
  if (data.getFullYear() !== ano || data.getMonth() !== mes - 1 || data.getDate() !== dia) {
    return null;
  }
  return data.toISOString();
}

/** Data OPCIONAL no formato DD/MM/AAAA. Vazia é válida; incompleta ou inexistente, não. */
export function dataValida(valor: string): Erro {
  if (valor.trim() === "") return null;
  const d = valor.replace(/\D/g, "");
  if (d.length < 8) return "Data incompleta (use DD/MM/AAAA).";
  return dataParaIso(valor) === null ? "Data inválida." : null;
}

/**
 * Valida um intervalo De/Até de datas mascaradas: cada uma precisa ser válida
 * (ou vazia) e "De" não pode ser posterior a "Até". Retorna a primeira falha.
 */
export function validarIntervalo(desde: string, ate: string): Erro {
  const eDesde = dataValida(desde);
  if (eDesde) return eDesde;
  const eAte = dataValida(ate);
  if (eAte) return eAte;
  const iDesde = dataParaIso(desde);
  const iAte = dataParaIso(ate, { fimDoDia: true });
  if (iDesde && iAte && iDesde > iAte) {
    return 'A data inicial ("De") não pode ser posterior à final ("Até").';
  }
  return null;
}

/**
 * Inteiro OPCIONAL: vazio é válido (retorna null). Quando preenchido, precisa
 * ser inteiro dentro da faixa. Use para km, ano, tempo etc.
 */
export function inteiroOpcional(
  valor: string,
  opts: { min?: number; max?: number; nome: string } = { nome: "Valor" },
): Erro {
  if (valor.trim() === "") return null;
  const n = Number(valor);
  if (!Number.isInteger(n)) return `${opts.nome} deve ser um número inteiro.`;
  if (opts.min !== undefined && n < opts.min) return `${opts.nome} não pode ser menor que ${opts.min}.`;
  if (opts.max !== undefined && n > opts.max) return `${opts.nome} não pode ser maior que ${opts.max}.`;
  return null;
}

/** Número decimal OPCIONAL dentro de uma faixa (ex.: coordenadas). */
export function decimalOpcional(
  valor: string,
  opts: { min?: number; max?: number; nome: string },
): Erro {
  if (valor.trim() === "") return null;
  const n = Number(valor);
  if (!Number.isFinite(n)) return `${opts.nome} deve ser um número.`;
  if (opts.min !== undefined && n < opts.min) return `${opts.nome} não pode ser menor que ${opts.min}.`;
  if (opts.max !== undefined && n > opts.max) return `${opts.nome} não pode ser maior que ${opts.max}.`;
  return null;
}

/**
 * Estado de erros por campo, com limpeza ao editar. Padrão usado em todos os
 * formulários: valida no submit, e some com o erro do campo assim que o
 * usuário começa a corrigi-lo.
 */
export function useErrosCampo() {
  const [erros, setErros] = useState<Record<string, string>>({});

  /** Remove o erro de um campo (chamar no onChange dele). */
  const limpar = useCallback((campo: string) => {
    setErros((prev) => {
      if (!prev[campo]) return prev;
      const proximo = { ...prev };
      delete proximo[campo];
      return proximo;
    });
  }, []);

  const limparTudo = useCallback(() => setErros({}), []);

  return { erros, setErros, limpar, limparTudo };
}

/**
 * Reúne os erros de um formulário. Recebe um mapa campo → Erro e devolve só
 * os que falharam. Se o resultado tiver chaves, há erro.
 */
export function coletar(mapa: Record<string, Erro>): Record<string, string> {
  const saida: Record<string, string> = {};
  for (const [campo, erro] of Object.entries(mapa)) {
    if (erro) saida[campo] = erro;
  }
  return saida;
}
