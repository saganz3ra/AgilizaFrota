"use client";

import { useCallback } from "react";
import { useChamadosStream, EventoChamado } from "@/lib/useChamadosStream";
import { tocarAlerta } from "@/lib/som";
import { notificarNovoChamado } from "@/lib/notificacoes";

/**
 * Assinante GLOBAL de novos chamados (não renderiza nada).
 *
 * Por que global e não só na tela de Chamados: o alerta (som + notificação do
 * navegador) precisa alcançar o operador esteja ele em qualquer tela — ou até
 * com a aba minimizada. Antes, o som só tocava quando a tela de Chamados
 * estava aberta, o que anulava o propósito de um alerta.
 *
 * A tela de Chamados continua com a própria assinatura para a LISTA ao vivo;
 * este componente cuida apenas dos ALERTAS, então o som não toca em dobro.
 */
export function OuvinteChamados() {
  const aoEvento = useCallback((e: EventoChamado) => {
    if (e.tipo !== "novo") return;
    const critico = e.chamado.prioridade === "critica";
    tocarAlerta(critico ? 3 : 1); // crítico insiste mais
    notificarNovoChamado(e.chamado);
  }, []);

  useChamadosStream(aoEvento);
  return null;
}
