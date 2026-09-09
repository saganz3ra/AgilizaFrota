"use client";

import { useEffect, useRef } from "react";
import { VeiculoNoMapa, PosicaoGps, StatusRastreamento } from "@/types/api";

/**
 * Mapa da frota com Leaflet + OpenStreetMap.
 *
 * DECISÃO DE PROJETO: Leaflet/OSM em vez de Google Maps ou MapBox.
 * As duas alternativas comerciais exigem cadastro com cartão de crédito e
 * criam dependência de fornecedor pago — algo que pesa num sistema
 * municipal de saúde, onde a conta precisa caber no orçamento público e a
 * operação não pode parar por corte de cota. Leaflet é software livre e o
 * OpenStreetMap tem cobertura mais que suficiente para a região atendida.
 *
 * CUIDADO COM O CICLO DE VIDA: o Leaflet guarda estado no DOM. Em
 * desenvolvimento o React monta, desmonta e remonta cada componente (Strict
 * Mode), e adicionar camadas a um mapa que já foi destruído produz erros
 * internos difíceis de ler — foi o que causou o "Cannot read properties of
 * undefined (reading 'x')". Por isso aqui: a biblioteca é carregada uma
 * única vez por uma promessa compartilhada, e toda escrita no mapa verifica
 * antes se ele ainda está vivo.
 */

// --------------------------------------------------------------------------
// Tipagem mínima do Leaflet (evita uma dependência de tipos só para isto)
// --------------------------------------------------------------------------
type LeafletMapa = {
  setView: (centro: [number, number], zoom: number) => LeafletMapa;
  remove: () => void;
  fitBounds: (limites: [number, number][], opcoes?: unknown) => void;
  invalidateSize: () => void;
  getContainer: () => HTMLElement;
};

type LeafletCamada = {
  addTo: (m: LeafletMapa) => LeafletCamada;
  remove: () => void;
};

/**
 * O marcador precisa de tipo próprio: `addTo` devolve o próprio marcador,
 * não uma camada genérica. Sem isso, encadear `.addTo(mapa)` perderia os
 * métodos `bindPopup` e `on`.
 */
type LeafletMarcador = {
  addTo: (m: LeafletMapa) => LeafletMarcador;
  remove: () => void;
  bindPopup: (html: string) => LeafletMarcador;
  on: (evento: string, cb: () => void) => LeafletMarcador;
};

type Leaflet = {
  map: (el: HTMLElement, opcoes?: unknown) => LeafletMapa;
  tileLayer: (url: string, opcoes?: unknown) => LeafletCamada;
  marker: (pos: [number, number], opcoes?: unknown) => LeafletMarcador;
  polyline: (pontos: [number, number][], opcoes?: unknown) => LeafletCamada;
  divIcon: (opcoes: unknown) => unknown;
};

declare global {
  interface Window {
    L?: Leaflet;
  }
}

// --------------------------------------------------------------------------
// Carregamento da biblioteca — uma única promessa para toda a aplicação
// --------------------------------------------------------------------------
const VERSAO_LEAFLET = "1.9.4";
let promessaLeaflet: Promise<Leaflet> | null = null;

function carregarLeaflet(): Promise<Leaflet> {
  if (window.L) return Promise.resolve(window.L);
  if (promessaLeaflet) return promessaLeaflet;

  promessaLeaflet = new Promise<Leaflet>((resolver, rejeitar) => {
    if (!document.getElementById("leaflet-css")) {
      const css = document.createElement("link");
      css.id = "leaflet-css";
      css.rel = "stylesheet";
      css.href = `https://unpkg.com/leaflet@${VERSAO_LEAFLET}/dist/leaflet.css`;
      document.head.appendChild(css);
    }

    const existente = document.getElementById("leaflet-js") as HTMLScriptElement | null;
    if (existente) {
      existente.addEventListener("load", () => resolver(window.L!));
      return;
    }

    const script = document.createElement("script");
    script.id = "leaflet-js";
    script.src = `https://unpkg.com/leaflet@${VERSAO_LEAFLET}/dist/leaflet.js`;
    script.async = true;
    script.onload = () => resolver(window.L!);
    script.onerror = () =>
      rejeitar(new Error("Não foi possível carregar o mapa. Verifique a conexão."));
    document.body.appendChild(script);
  });

  return promessaLeaflet;
}

// --------------------------------------------------------------------------

const CORES: Record<StatusRastreamento, string> = {
  online: "#157347",
  instavel: "#c4560c",
  offline: "#b42318",
  sem_dados: "#5b6472",
};

// Guarapuava/PR — centro padrão quando nenhum veículo tem posição ainda.
const CENTRO_PADRAO: [number, number] = [-25.3907, -51.457];

/** Coordenada só é usável se for número finito e dentro da faixa válida. */
function coordenadaValida(lat: unknown, lng: unknown): boolean {
  const a = Number(lat);
  const b = Number(lng);
  return (
    Number.isFinite(a) &&
    Number.isFinite(b) &&
    a >= -90 &&
    a <= 90 &&
    b >= -180 &&
    b <= 180 &&
    // (0,0) é o "ponto nulo" no Atlântico: quase sempre indica GPS sem fixo.
    !(a === 0 && b === 0)
  );
}

interface Props {
  veiculos: VeiculoNoMapa[];
  rastro?: PosicaoGps[];
  aoSelecionar?: (veiculoId: string) => void;
  /** Recebe uma função que recentraliza o mapa na frota, sob demanda. */
  aoPreparar?: (centralizar: () => void) => void;
}

export function MapaFrota({ veiculos, rastro, aoSelecionar, aoPreparar }: Props) {
  const divRef = useRef<HTMLDivElement>(null);
  const mapaRef = useRef<LeafletMapa | null>(null);
  const camadasRef = useRef<LeafletCamada[]>([]);
  const jaEnquadrou = useRef(false);

  // Dados mais recentes, para o desenho inicial logo após o mapa nascer.
  const dadosRef = useRef({ veiculos, rastro, aoSelecionar });
  dadosRef.current = { veiculos, rastro, aoSelecionar };

  // 1. Cria o mapa uma vez e o destrói ao sair.
  useEffect(() => {
    let cancelado = false;

    carregarLeaflet()
      .then((L) => {
        // O componente pode ter sido desmontado enquanto o script carregava.
        if (cancelado || !divRef.current || mapaRef.current) return;

        const mapa = L.map(divRef.current).setView(CENTRO_PADRAO, 13);
        L.tileLayer(`https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png`, {
          maxZoom: 19,
          attribution: "© OpenStreetMap",
        }).addTo(mapa);

        mapaRef.current = mapa;

        // O contêiner só ganha altura depois do primeiro layout; sem isto
        // o Leaflet calcula posições com tamanho zero e desenha errado.
        setTimeout(() => {
          if (mapaRef.current) mapaRef.current.invalidateSize();
        }, 0);

        desenhar();

        // Entrega ao pai um jeito de recentralizar: se o operador se perder
        // navegando pelo mapa, um clique traz a frota de volta.
        aoPreparar?.(() => {
          jaEnquadrou.current = false;
          desenhar();
        });
      })
      .catch(() => {
        // Falha ao baixar a biblioteca: a tela segue funcionando sem mapa.
      });

    return () => {
      cancelado = true;
      camadasRef.current = [];
      if (mapaRef.current) {
        mapaRef.current.remove();
        mapaRef.current = null;
      }
      jaEnquadrou.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 2. Redesenha quando os dados mudam.
  useEffect(() => {
    desenhar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [veiculos, rastro]);

  function desenhar() {
    const L = window.L;
    const mapa = mapaRef.current;
    if (!L || !mapa) return;

    // O mapa pode ter sido destruído entre o agendamento e a execução.
    // Escrever nele nesse estado é o que gera erros internos do Leaflet.
    try {
      if (!mapa.getContainer().isConnected) return;
    } catch {
      return;
    }

    const { veiculos: lista, rastro: trajeto, aoSelecionar: aoClicar } =
      dadosRef.current;

    // Remove o que estava desenhado. Para uma frota pequena, redesenhar é
    // mais simples e mais seguro que reconciliar marcador por marcador.
    camadasRef.current.forEach((c) => {
      try {
        c.remove();
      } catch {
        // camada já removida junto com o mapa
      }
    });
    camadasRef.current = [];

    const comPosicao = lista.filter((v) => coordenadaValida(v.lat, v.lng));

    // Trajeto histórico, desenhado por baixo dos marcadores.
    if (trajeto && trajeto.length > 1) {
      const pontos = trajeto
        .filter((p) => !p.descartada && coordenadaValida(p.lat, p.lng))
        .map((p) => [Number(p.lat), Number(p.lng)] as [number, number]);

      if (pontos.length > 1) {
        const linha = L.polyline(pontos, {
          color: "#1256b8",
          weight: 4,
          opacity: 0.6,
        }).addTo(mapa);
        camadasRef.current.push(linha);
      }
    }

    for (const v of comPosicao) {
      const cor = CORES[v.rastreamento] ?? CORES.sem_dados;
      const icone = L.divIcon({
        className: "",
        html: `<div style="
                 background:${cor};
                 width:30px;height:30px;border-radius:50%;
                 border:3px solid #fff;
                 box-shadow:0 1px 4px rgba(0,0,0,.4);
                 display:flex;align-items:center;justify-content:center;
                 color:#fff;font-size:11px;font-weight:700;">
                 ${v.placa.slice(0, 3)}
               </div>`,
        iconSize: [30, 30],
        iconAnchor: [15, 15],
      });

      const marcador = L.marker([Number(v.lat), Number(v.lng)], { icon: icone });
      marcador.addTo(mapa);

      marcador.bindPopup(`
        <strong>${v.placa}</strong> — ${v.modelo}<br/>
        ${v.motorista_nome ? `Motorista: ${v.motorista_nome}<br/>` : ""}
        ${v.velocidade_kmh !== null ? `${Math.round(Number(v.velocidade_kmh))} km/h<br/>` : ""}
        <span style="color:${cor};font-weight:600">${rotuloStatus(v.rastreamento)}</span><br/>
        <span style="color:#5b6472;font-size:11px">
          ${Number(v.lat).toFixed(5)}, ${Number(v.lng).toFixed(5)}
        </span>
      `);

      if (aoClicar) marcador.on("click", () => aoClicar(v.veiculo_id));
      camadasRef.current.push(marcador);
    }

    // Enquadra a frota só na primeira vez que houver algo para mostrar:
    // reenquadrar a cada posição faria o mapa "pular" sob o operador
    // enquanto ele analisa a tela.
    if (!jaEnquadrou.current && comPosicao.length > 0) {
      try {
        // O contêiner precisa estar com o tamanho final antes de calcular
        // o enquadramento, senão o Leaflet erra a conta.
        mapa.invalidateSize();

        if (comPosicao.length === 1) {
          // Um ponto só não define uma área: `fitBounds` sobre uma caixa de
          // tamanho zero produz um zoom imprevisível (às vezes o mundo
          // inteiro). Centralizar é o comportamento correto aqui.
          const v = comPosicao[0];
          mapa.setView([Number(v.lat), Number(v.lng)], 15);
        } else {
          mapa.fitBounds(
            comPosicao.map((v) => [Number(v.lat), Number(v.lng)] as [number, number]),
            { padding: [50, 50], maxZoom: 15 },
          );
        }
        jaEnquadrou.current = true;
      } catch {
        // enquadramento é conveniência; falhar aqui não pode derrubar a tela
      }
    }
  }

  return (
    <div
      ref={divRef}
      className="h-full w-full rounded-card border border-surface-border"
      style={{ minHeight: 420, zIndex: 0 }}
    />
  );
}

export function rotuloStatus(status: StatusRastreamento): string {
  switch (status) {
    case "online":
      return "Online";
    case "instavel":
      return "Sinal instável";
    case "offline":
      return "Offline";
    default:
      return "Sem dados de GPS";
  }
}

export { CORES as CORES_RASTREAMENTO };
