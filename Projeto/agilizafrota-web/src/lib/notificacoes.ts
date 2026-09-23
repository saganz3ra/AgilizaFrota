"use client";

import { Chamado } from "@/types/api";

const CHAVE = "notificacoes";

/**
 * Notificações do navegador (Web Notifications API) para novos chamados.
 *
 * É preferência por navegador (localStorage), como tema e som. A API exige
 * permissão explícita do usuário — pedimos no momento em que ele LIGA a opção,
 * não na carga da página (pedir permissão sem contexto costuma ser negado).
 */
export function notificacoesAtivas(): boolean {
  try {
    return localStorage.getItem(CHAVE) === "on";
  } catch {
    return false;
  }
}

export function definirNotificacoes(ativo: boolean): void {
  try {
    localStorage.setItem(CHAVE, ativo ? "on" : "off");
  } catch {
    /* localStorage indisponível: vale só nesta sessão */
  }
}

/** Suporte do navegador à API de notificações. */
export function suportaNotificacoes(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

/**
 * Pede permissão ao navegador. Devolve true só se concedida — o chamador usa
 * isso para NÃO ligar a opção quando o usuário negar.
 */
export async function pedirPermissao(): Promise<boolean> {
  if (!suportaNotificacoes()) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  try {
    return (await Notification.requestPermission()) === "granted";
  } catch {
    return false;
  }
}

/**
 * Mostra a notificação de um novo chamado, se: a opção está ligada, o navegador
 * concedeu permissão e a aba NÃO está visível (o valor da notificação é
 * justamente alcançar o operador quando ele não está olhando a tela).
 */
export function notificarNovoChamado(chamado: Chamado): void {
  if (!notificacoesAtivas()) return;
  if (!suportaNotificacoes() || Notification.permission !== "granted") return;
  if (document.visibilityState === "visible") return;

  try {
    const n = new Notification("Novo chamado", {
      body: `${chamado.natureza} · prioridade ${chamado.prioridade}`,
      // `tag` evita empilhar várias notificações do mesmo tipo.
      tag: "agiliza-chamado",
    });
    // Ao clicar, traz a janela do sistema para frente.
    n.onclick = () => {
      window.focus();
      n.close();
    };
  } catch {
    /* alguns navegadores restringem o construtor fora de service worker */
  }
}
