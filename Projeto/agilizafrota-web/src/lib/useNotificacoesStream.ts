"use client";

import { useEffect, useRef, useState } from "react";
import { auth } from "./firebase";
import { apiUrl } from "./api";
import { Notificacao } from "@/types/api";

/**
 * Assina o stream de notificações (RF15).
 *
 * O backend entrega o evento apenas aos destinatários da notificação, então
 * a recepcionista recebe só o que é da unidade dela — a filtragem acontece
 * no servidor, não aqui.
 */
export function useNotificacoesStream(aoReceber: (n: Notificacao) => void) {
  const [conectado, setConectado] = useState(false);
  const refCallback = useRef(aoReceber);
  refCallback.current = aoReceber;

  useEffect(() => {
    let es: EventSource | null = null;
    let encerrado = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function conectar() {
      const usuario = auth.currentUser;
      if (!usuario || encerrado) return;
      const token = await usuario.getIdToken();
      es = new EventSource(
        apiUrl(`/notificacoes/stream?token=${encodeURIComponent(token)}`),
      );

      es.addEventListener("conectado", () => setConectado(true));

      es.addEventListener("notificacao:nova", (ev) => {
        try {
          refCallback.current(JSON.parse((ev as MessageEvent).data) as Notificacao);
        } catch {
          // payload inválido: ignora em vez de derrubar a tela
        }
      });

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
