/**
 * Carregador do Leaflet compartilhado entre os mapas do painel.
 *
 * Por que um módulo à parte: o mapa da frota (MapaFrota) já tinha essa lógica
 * embutida; ao surgir um segundo mapa (rota de atendimento) o carregamento foi
 * extraído para cá, para não duplicar a injeção do script/CSS e o cuidado com
 * o ciclo de vida do Leaflet. O MapaFrota pode ser migrado para este módulo
 * depois, num commit próprio verificado.
 *
 * Decisão de projeto (mantida): Leaflet + OpenStreetMap em vez de Google/MapBox
 * — sem cadastro com cartão nem dependência de fornecedor pago, o que importa
 * num sistema municipal de saúde. Ver comentário original em MapaFrota.
 *
 * NÃO usamos `declare global` para `window.L` de propósito: isso colidiria com
 * a declaração que o MapaFrota ainda mantém. Aqui o acesso é por cast local.
 */

// Tipagem mínima do Leaflet — só o que os mapas do projeto usam.
export type LeafletMapa = {
  setView: (centro: [number, number], zoom: number) => LeafletMapa;
  remove: () => void;
  fitBounds: (limites: [number, number][], opcoes?: unknown) => void;
  invalidateSize: () => void;
  getContainer: () => HTMLElement;
};

export type LeafletCamada = {
  addTo: (m: LeafletMapa) => LeafletCamada;
  remove: () => void;
};

export type LeafletMarcador = {
  addTo: (m: LeafletMapa) => LeafletMarcador;
  remove: () => void;
  bindPopup: (html: string) => LeafletMarcador;
  on: (evento: string, cb: () => void) => LeafletMarcador;
};

export type Leaflet = {
  map: (el: HTMLElement, opcoes?: unknown) => LeafletMapa;
  tileLayer: (url: string, opcoes?: unknown) => LeafletCamada;
  marker: (pos: [number, number], opcoes?: unknown) => LeafletMarcador;
  polyline: (pontos: [number, number][], opcoes?: unknown) => LeafletCamada;
  divIcon: (opcoes: unknown) => unknown;
};

const VERSAO_LEAFLET = "1.9.4";
let promessaLeaflet: Promise<Leaflet> | null = null;

/** Leaflet exposto no window pelo script UMD, sem augmentar o tipo global. */
function leafletDoWindow(): Leaflet | undefined {
  return (window as unknown as { L?: Leaflet }).L;
}

/**
 * Carrega o Leaflet (CSS + JS) uma única vez. Idempotente: se o script já foi
 * injetado (por este módulo ou pelo MapaFrota), reaproveita — a checagem é por
 * `window.L` e pelo id do elemento, então os dois carregadores convivem.
 */
export function carregarLeaflet(): Promise<Leaflet> {
  const existenteL = typeof window !== "undefined" ? leafletDoWindow() : undefined;
  if (existenteL) return Promise.resolve(existenteL);
  if (promessaLeaflet) return promessaLeaflet;

  promessaLeaflet = new Promise<Leaflet>((resolver, rejeitar) => {
    if (!document.getElementById("leaflet-css")) {
      const css = document.createElement("link");
      css.id = "leaflet-css";
      css.rel = "stylesheet";
      css.href = `https://unpkg.com/leaflet@${VERSAO_LEAFLET}/dist/leaflet.css`;
      document.head.appendChild(css);
    }

    const aoCarregar = () => {
      const L = leafletDoWindow();
      if (L) resolver(L);
      else rejeitar(new Error("Leaflet carregou sem expor a API global."));
    };

    const existente = document.getElementById("leaflet-js") as HTMLScriptElement | null;
    if (existente) {
      existente.addEventListener("load", aoCarregar);
      // Pode já ter carregado antes deste listener: cobre a corrida.
      if (leafletDoWindow()) aoCarregar();
      return;
    }

    const script = document.createElement("script");
    script.id = "leaflet-js";
    script.src = `https://unpkg.com/leaflet@${VERSAO_LEAFLET}/dist/leaflet.js`;
    script.async = true;
    script.onload = aoCarregar;
    script.onerror = () =>
      rejeitar(new Error("Não foi possível carregar o mapa. Verifique a conexão."));
    document.body.appendChild(script);
  });

  return promessaLeaflet;
}
