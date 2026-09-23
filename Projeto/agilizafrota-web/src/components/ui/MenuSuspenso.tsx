"use client";

import { ReactNode, useEffect, useRef, useState } from "react";

/**
 * Menu suspenso (dropdown) reutilizavel.
 *
 * Concentra num lugar so o comportamento chato de todo dropdown: fechar ao
 * clicar fora e ao apertar Esc. Assim o seletor de dashboards e o menu da
 * engrenagem nao repetem essa logica - so descrevem o gatilho e o conteudo.
 *
 * `children` pode ser uma funcao que recebe `fechar`, para um item de menu
 * fechar o menu ao ser acionado (ex.: um link de navegacao).
 */
export function MenuSuspenso({
  gatilho,
  classeGatilho = "",
  alinhar = "esquerda",
  rotulo,
  children,
}: {
  gatilho: ReactNode;
  classeGatilho?: string;
  alinhar?: "esquerda" | "direita";
  rotulo?: string;
  children: ReactNode | ((fechar: () => void) => ReactNode);
}) {
  const [aberto, setAberto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!aberto) return;
    function aoClicarFora(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setAberto(false);
    }
    function aoTeclar(e: KeyboardEvent) {
      if (e.key === "Escape") setAberto(false);
    }
    document.addEventListener("mousedown", aoClicarFora);
    document.addEventListener("keydown", aoTeclar);
    return () => {
      document.removeEventListener("mousedown", aoClicarFora);
      document.removeEventListener("keydown", aoTeclar);
    };
  }, [aberto]);

  const fechar = () => setAberto(false);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setAberto((a) => !a)}
        aria-haspopup="menu"
        aria-expanded={aberto}
        aria-label={rotulo}
        className={classeGatilho}
      >
        {gatilho}
      </button>

      {aberto && (
        <div
          role="menu"
          className={[
            "absolute z-50 mt-2 min-w-[220px] overflow-hidden rounded-card border border-surface-border bg-surface p-1.5 shadow-card",
            alinhar === "direita" ? "right-0" : "left-0",
          ].join(" ")}
        >
          {typeof children === "function" ? children(fechar) : children}
        </div>
      )}
    </div>
  );
}
