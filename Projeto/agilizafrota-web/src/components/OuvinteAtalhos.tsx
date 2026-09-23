"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { usePreferencias } from "@/lib/preferencias";
import { normalizarTecla } from "@/lib/atalhos";

/**
 * Ouve o teclado em toda a aplicação e navega quando a tecla pressionada tem
 * um atalho configurado. Não renderiza nada — é só o "ouvido" global.
 *
 * Regras importantes:
 *  - ignora quando o foco está num campo de texto, senão digitar "F8" num
 *    formulário levaria o operador para outra tela no meio do preenchimento;
 *  - pausa enquanto a tela de Configurações está capturando uma tecla (flag
 *    `capturando`), para o ato de DEFINIR o atalho não disparar a navegação.
 */
export function OuvinteAtalhos() {
  const router = useRouter();
  const { atalhos, capturando } = usePreferencias();

  useEffect(() => {
    function aoTeclar(e: KeyboardEvent) {
      if (capturando) return;

      const alvo = e.target as HTMLElement | null;
      if (
        alvo &&
        (alvo.tagName === "INPUT" ||
          alvo.tagName === "TEXTAREA" ||
          alvo.tagName === "SELECT" ||
          alvo.isContentEditable)
      ) {
        return;
      }

      const tecla = normalizarTecla(e);
      if (!tecla) return;

      const href = Object.keys(atalhos).find((h) => atalhos[h] === tecla);
      if (href) {
        e.preventDefault();
        router.push(href);
      }
    }

    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [atalhos, capturando, router]);

  return null;
}
