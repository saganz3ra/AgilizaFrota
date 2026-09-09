"use client";

import { useEffect, useRef, useState } from "react";
import { auth } from "./firebase";
import { apiUrl } from "./api";

/**
 * Posição publicada pelo backend no evento `frota:posicao`.
 * É a linha da tabela `posicoes`, não o veículo inteiro — por isso a tela
 * mescla o ponto recebido com o veículo que já está no mapa.
 */
export interface PosicaoRecebida {
  veiculo_id: string;
  lat: number;
  lng: number;
  velocidade_kmh: number | null;
  direcao_graus: number | null;
  precisao_m: number | null;
  qualidade: string | null;
  registrado_em: string;
  recebido_em: string;
}

/**
 * Assina o stream de posições da frota (RF11).
 *
 * Mesma mecânica do stream de chamados: o token vai na query string porque
 * o `EventSource` do navegador não envia cabeçalhos, e a reconexão é
 * automática — um painel de monitoramento fica aberto o dia inteiro e não
 * pode depender de alguém recarregar a página depois de uma oscilação.
 */
export function useFrotaStream(aoReceber: (p: PosicaoRecebida) => void) {
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
      es = new EventSource(apiUrl(`/frota/stream?token=${encodeURIComponent(token)}`));

      es.addEventListener("conectado", () => setConectado(true));

      es.addEventListener("frota:posicao", (ev) => {
        try {
          refCallback.current(JSON.parse((ev as MessageEvent).data) as PosicaoRecebida);
        } catch {
          // payload inválido: ignora em vez de derrubar o painel
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
