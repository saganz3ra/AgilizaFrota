"use client";

const CHAVE_SOM = "som";

/**
 * Preferencia de sons do app (padrao: LIGADO), por navegador.
 *
 * Fica em localStorage (nao em Context) de proposito: `tocarAlerta` e chamado
 * de codigo comum, fora de componentes React, entao precisa consultar a
 * escolha sem depender de hook. O Context de preferencias apenas espelha e
 * escreve esta mesma chave.
 */
export function sonsAtivos(): boolean {
  try {
    // Ausente => ligado; so "off" desliga.
    return localStorage.getItem(CHAVE_SOM) !== "off";
  } catch {
    return true; // sem localStorage: mantem o padrao
  }
}

/** Grava a preferencia de som. */
export function definirSons(ativo: boolean): void {
  try {
    localStorage.setItem(CHAVE_SOM, ativo ? "on" : "off");
  } catch {
    /* localStorage indisponivel: vale so nesta sessao */
  }
}

/**
 * Toca um alerta sonoro curto usando a Web Audio API (sem depender de arquivo).
 * Usado quando chega um novo chamado (RF06). Falha silenciosamente se o
 * navegador bloquear áudio antes de uma interação do usuário, e nao faz nada
 * se o usuario tiver desativado os sons nas Configuracoes.
 *
 * `repeticoes` deixa o alerta mais insistente para casos urgentes: um chamado
 * crítico toca algumas vezes seguidas, para não passar despercebido numa
 * central movimentada.
 */
export function tocarAlerta(repeticoes = 1): void {
  if (!sonsAtivos()) return;
  const vezes = Math.max(1, repeticoes);
  for (let i = 0; i < vezes; i++) {
    // Espaça os bipes; o primeiro toca já.
    window.setTimeout(tocarBipe, i * 450);
  }
}

/** Um bipe curto via Web Audio (sem depender de arquivo). */
function tocarBipe(): void {
  try {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.15, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.36);
    osc.onended = () => ctx.close();
  } catch {
    // ignora: audio indisponivel
  }
}
