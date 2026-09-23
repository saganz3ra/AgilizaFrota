"use client";

import { useMemo } from "react";
import { usePreferencias } from "./preferencias";

/**
 * Cores dos gráficos lidas dos TOKENS do app (globals.css), para os gráficos
 * seguirem o mesmo sistema visual e trocarem de cor junto com o tema.
 *
 * Por que ler os tokens em runtime (e não fixar hex): o tema escuro redefine
 * várias variáveis. Lendo do DOM e recalculando quando `escuro` muda, os
 * gráficos acompanham o tema sem duplicar paleta.
 */
export interface PaletaGrafico {
  texto: string;
  textoSuave: string;
  grade: string;
  superficie: string;
  prioridade: { critica: string; alta: string; media: string; baixa: string };
  statusVeiculo: { disponivel: string; uso: string; manutencao: string };
  serie: { chamados: string; atendimentos: string; km: string };
}

function tok(nome: string, alternativa: string): string {
  if (typeof window === "undefined") return alternativa;
  const v = getComputedStyle(document.documentElement)
    .getPropertyValue(nome)
    .trim();
  return v || alternativa;
}

export function usePaletaGrafico(): PaletaGrafico {
  const { escuro, montado } = usePreferencias();
  return useMemo(
    () => ({
      texto: tok("--content", "#0f2233"),
      textoSuave: tok("--content-muted", "#64748b"),
      grade: tok("--surface-border", "#e6ebf1"),
      superficie: tok("--surface", "#ffffff"),
      // Prioridade usa os tons SÓLIDOS (constantes nos dois temas), os mesmos
      // dos blocos de prioridade — para o operador reconhecer as cores.
      prioridade: {
        critica: tok("--prio-critica-solida", "#dc2626"),
        alta: tok("--prio-alta-solida", "#ea580c"),
        media: tok("--prio-media-solida", "#2563eb"),
        baixa: tok("--prio-baixa-solida", "#64748b"),
      },
      // Status de veículo e séries usam os tokens que CLAREIAM no escuro, para
      // manter contraste sobre o fundo escuro.
      statusVeiculo: {
        disponivel: tok("--status-disponivel", "#16a34a"),
        uso: tok("--status-uso", "#2563eb"),
        manutencao: tok("--status-manutencao", "#d97706"),
      },
      serie: {
        chamados: tok("--status-uso", "#2563eb"),
        atendimentos: tok("--brand", "#16a34a"),
        km: tok("--status-manutencao", "#d97706"),
      },
    }),
    // Recalcula quando o tema muda (o valor lido do DOM muda junto).
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [escuro, montado],
  );
}

/* ==========================================================================
   Helpers de agregação por dia (para as séries temporais da tela Evolução).
   Tudo em horário LOCAL, para o "dia" bater com o fuso do operador.
   ========================================================================== */

/** Chave de dia (AAAA-MM-DD) a partir de uma Data, em horário local. */
export function chaveDiaDeData(d: Date): string {
  const ano = d.getFullYear();
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

/** Chave de dia a partir de um timestamp ISO; "" se inválido. */
export function chaveDia(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : chaveDiaDeData(d);
}

/** Rótulo curto DD/MM a partir da chave AAAA-MM-DD. */
export function rotuloDia(chave: string): string {
  const [, m, d] = chave.split("-");
  return `${d}/${m}`;
}

/** Chaves de dia dos últimos `n` dias, do mais antigo ao de hoje (inclusive). */
export function ultimosDias(n: number): string[] {
  const dias: string[] = [];
  const hoje = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(hoje);
    d.setDate(hoje.getDate() - i);
    dias.push(chaveDiaDeData(d));
  }
  return dias;
}
