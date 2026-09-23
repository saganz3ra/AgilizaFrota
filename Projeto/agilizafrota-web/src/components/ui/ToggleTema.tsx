"use client";

import { Moon, Sun } from "lucide-react";
import { usePreferencias } from "@/lib/preferencias";

/**
 * Atalho de tema claro/escuro na barra superior.
 *
 * O estado vem do PreferenciasContext, o mesmo usado pela tela de
 * Configuracoes: alternar aqui reflete la, e vice-versa.
 */
export function ToggleTema() {
  const { montado, escuro, alternarTema } = usePreferencias();

  return (
    <button
      type="button"
      onClick={alternarTema}
      aria-label={escuro ? "Ativar tema claro" : "Ativar tema escuro"}
      title={escuro ? "Tema claro" : "Tema escuro"}
      className="flex h-9 w-9 items-center justify-center rounded-lg border border-surface-border text-content-muted transition-colors hover:bg-surface-muted hover:text-content"
    >
      {/* Antes de montar, um espaco reservado do mesmo tamanho evita "pulo" de
          layout e o warning de hidratacao. Sol = "ir para o claro" (estou no
          escuro); Lua = "ir para o escuro". */}
      {!montado ? (
        <span className="h-[18px] w-[18px]" />
      ) : escuro ? (
        <Sun size={18} />
      ) : (
        <Moon size={18} />
      )}
    </button>
  );
}
