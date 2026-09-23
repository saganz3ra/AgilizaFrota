"use client";

import { Papel } from "@/types/api";

const CHAVE = "atalhos";

/** Uma tela que pode receber um atalho de teclado, e quem pode usá-la. */
type Destino = { href: string; rotulo: string; papeis: Papel[] };

/**
 * Telas vinculáveis a um atalho.
 *
 * De propósito é um subconjunto (as telas "quentes" que o operador alterna sob
 * pressão), não o menu inteiro: atalho para cada uma das ~13 telas viraria uma
 * lista de teclas que ninguém decora. Se precisar, é só acrescentar aqui.
 */
export const DESTINOS_ATALHO: Destino[] = [
  { href: "/dashboard", rotulo: "Painel", papeis: ["central"] },
  { href: "/chamados", rotulo: "Chamados", papeis: ["central"] },
  { href: "/frota", rotulo: "Frota", papeis: ["central"] },
  { href: "/atendimentos", rotulo: "Atendimentos", papeis: ["central"] },
  { href: "/rotas", rotulo: "Rotas e ETA", papeis: ["central"] },
  { href: "/chegadas", rotulo: "Chegadas", papeis: ["central", "recepcionista"] },
];

/** Telas vinculáveis para um papel. */
export function destinosPara(papel: Papel | undefined): Destino[] {
  if (!papel) return [];
  return DESTINOS_ATALHO.filter((d) => d.papeis.includes(papel));
}

/** Mapa href -> tecla (ex.: { "/chamados": "F8" }). */
export type MapaAtalhos = Record<string, string>;

export function lerAtalhos(): MapaAtalhos {
  try {
    const bruto = localStorage.getItem(CHAVE);
    return bruto ? (JSON.parse(bruto) as MapaAtalhos) : {};
  } catch {
    return {};
  }
}

export function gravarAtalhos(mapa: MapaAtalhos): void {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(mapa));
  } catch {
    /* localStorage indisponível: vale só nesta sessão */
  }
}

/**
 * Representação textual da combinação pressionada (ex.: "F8", "Ctrl+K").
 * Devolve null quando só há modificador pressionado (Ctrl/Alt/Shift sozinho),
 * para o chamador continuar esperando a tecla "de verdade".
 */
export function normalizarTecla(e: KeyboardEvent): string | null {
  const k = e.key;
  if (k === "Control" || k === "Alt" || k === "Shift" || k === "Meta") return null;

  const partes: string[] = [];
  if (e.ctrlKey) partes.push("Ctrl");
  if (e.altKey) partes.push("Alt");
  if (e.shiftKey) partes.push("Shift");

  let tecla = k;
  if (k === " ") tecla = "Espaço";
  else if (k.length === 1) tecla = k.toUpperCase();
  partes.push(tecla);

  return partes.join("+");
}
