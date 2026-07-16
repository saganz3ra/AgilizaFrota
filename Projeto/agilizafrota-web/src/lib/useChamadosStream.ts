"use client";

import { useEffect, useRef, useState } from "react";
import { auth } from "./firebase";
import { apiUrl } from "./api";
import { Chamado } from "@/types/api";

export interface EventoChamado {
  tipo: "novo" | "atualizado";
  chamado: Chamado;
}

/**
 * Assina o stream de alertas de chamados (SSE) do backend.
 * O token do Firebase vai na query string (o EventSource não envia cabeçalhos).
 * Reconecta automaticamente em caso de queda ou expiração do token.
 */
export function useChamadosStream(aoEvento: (e: EventoChamado) => void) {
  const [conectado, setConectado] = useState(false);
  const refCallback = useRef(aoEvento);
  refCallback.current = aoEvento;

  useEffect(() => {
    let es: EventSource | null = null;
    let encerrado = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function conectar() {
      const usuario = auth.currentUser;
      if (!usuario || encerrado) return;
      const token = await usuario.getIdToken();
      es = new EventSource(apiUrl(`/chamados/stream?token=${encodeURIComponent(token)}`));

      es.addEventListener("conectado", () => setConectado(true));

      const tratar = (tipo: EventoChamado["tipo"]) => (ev: Event) => {
        try {
          const chamado = JSON.parse((ev as MessageEvent).data) as Chamado;
          refCallback.current({ tipo, chamado });
        } catch {
          // payload invalido: ignora
        }
      };
      es.addEventListener("chamado:novo", tratar("novo"));
      es.addEventListener("chamado:atualizado", tratar("atualizado"));

      es.onerror = () => {
        setConectado(false);
        es?.close();
        if (!encerrado) timer = setTimeout(conectar, 3000);
      };
    }

    void conectar();

    return () => {
      encerrado = true;
      if (timer) clearTimeout(timer);
      es?.close();
    };
  }, []);

  return { conectado };
}
