"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { RefreshCw, Radio, MapPin, Route, Crosshair } from "lucide-react";

import { api } from "@/lib/api";
import { useFrotaStream, PosicaoRecebida } from "@/lib/useFrotaStream";
import {
  MapaFrota as MapaTipo,
  VeiculoNoMapa,
  PosicaoGps,
  StatusRastreamento,
} from "@/types/api";
import { Card, CardBody } from "@/components/ui/Card";
import { Spinner } from "@/components/ui/Spinner";
import { Button } from "@/components/ui/Button";
import { rotuloStatus, CORES_RASTREAMENTO } from "@/components/frota/MapaFrota";

// O Leaflet acessa `window` já na importação, então o componente do mapa
// não pode ser renderizado no servidor.
const Mapa = dynamic(
  () => import("@/components/frota/MapaFrota").then((m) => m.MapaFrota),
  { ssr: false, loading: () => <div className="grid h-full place-items-center"><Spinner /></div> },
);

const FILTROS: { valor: StatusRastreamento | "todos"; rotulo: string }[] = [
  { valor: "todos", rotulo: "Todos" },
  { valor: "online", rotulo: "Online" },
  { valor: "instavel", rotulo: "Instável" },
  { valor: "offline", rotulo: "Offline" },
  { valor: "sem_dados", rotulo: "Sem GPS" },
];

/**
 * Monitoramento da frota em tempo real (RF11).
 *
 * A tela combina duas fontes: uma carga inicial por `GET /frota`, que traz
 * a última posição conhecida de cada veículo, e o stream `frota:posicao`,
 * que atualiza os pontos conforme chegam. Sem a carga inicial o mapa
 * ficaria vazio até alguém se mover; sem o stream, seria preciso recarregar
 * a página o tempo todo.
 */
export default function FrotaPage() {
  const [dados, setDados] = useState<MapaTipo | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [filtro, setFiltro] = useState<StatusRastreamento | "todos">("todos");
  const [selecionado, setSelecionado] = useState<string | null>(null);
  const [rastro, setRastro] = useState<PosicaoGps[] | undefined>();
  const centralizarRef = useRef<(() => void) | null>(null);

  const carregar = useCallback(async () => {
    try {
      const mapa = await api<MapaTipo>("/frota");
      setDados(mapa);
      setErro(null);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao carregar a frota.");
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
    // Releitura periódica: o stream traz posições novas, mas o STATUS de
    // rastreamento envelhece sozinho — um veículo que parou de enviar
    // precisa migrar de "online" para "offline" sem nenhum evento chegar.
    const t = setInterval(() => void carregar(), 60_000);
    return () => clearInterval(t);
  }, [carregar]);

  /** Mescla a posição recebida no veículo correspondente. */
  const aoReceberPosicao = useCallback((p: PosicaoRecebida) => {
    setDados((atual) => {
      if (!atual) return atual;
      return {
        ...atual,
        veiculos: atual.veiculos.map((v) =>
          v.veiculo_id === p.veiculo_id
            ? {
                ...v,
                lat: p.lat,
                lng: p.lng,
                velocidade_kmh: p.velocidade_kmh,
                direcao_graus: p.direcao_graus,
                precisao_m: p.precisao_m,
                registrado_em: p.registrado_em,
                recebido_em: p.recebido_em,
                rastreamento: "online" as StatusRastreamento,
                idade_segundos: 0,
              }
            : v,
        ),
      };
    });
  }, []);

  const { conectado } = useFrotaStream(aoReceberPosicao);

  async function verRastro(veiculoId: string) {
    setSelecionado(veiculoId);
    try {
      const r = await api<{ posicoes: PosicaoGps[] }>(
        `/frota/veiculos/${veiculoId}/posicoes?limite=200`,
      );
      // A API devolve do mais recente para o mais antigo; a linha precisa
      // da ordem cronológica para não desenhar o trajeto ao contrário.
      setRastro([...r.posicoes].reverse());
    } catch {
      setRastro(undefined);
    }
  }

  function limparRastro() {
    setSelecionado(null);
    setRastro(undefined);
  }

  const veiculos = dados?.veiculos ?? [];
  const visiveis = useMemo(
    () => (filtro === "todos" ? veiculos : veiculos.filter((v) => v.rastreamento === filtro)),
    [veiculos, filtro],
  );

  const contagem = useMemo(() => {
    const c: Record<string, number> = { online: 0, instavel: 0, offline: 0, sem_dados: 0 };
    veiculos.forEach((v) => (c[v.rastreamento] = (c[v.rastreamento] ?? 0) + 1));
    return c;
  }, [veiculos]);

  if (carregando) {
    return (
      <div className="grid h-64 place-items-center">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-content">Frota em tempo real</h1>
          <p className="text-sm text-content-muted">
            Posição dos veículos em turno, atualizada automaticamente.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span
            className={[
              "flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold",
              conectado
                ? "bg-status-disponivel/10 text-status-disponivel"
                : "bg-surface-muted text-content-muted",
            ].join(" ")}
            title={conectado ? "Recebendo posições em tempo real" : "Reconectando ao stream"}
          >
            <Radio size={14} />
            {conectado ? "Ao vivo" : "Reconectando"}
          </span>
          <Button
            variante="secundario"
            onClick={() => centralizarRef.current?.()}
            title="Centralizar o mapa na frota"
          >
            <Crosshair size={16} /> Centralizar
          </Button>
          <Button variante="secundario" onClick={() => void carregar()}>
            <RefreshCw size={16} /> Atualizar
          </Button>
        </div>
      </div>

      {erro && (
        <Card>
          <CardBody>
            <p className="text-sm text-prioridade-critica">{erro}</p>
          </CardBody>
        </Card>
      )}

      <div className="flex flex-wrap gap-2">
        {FILTROS.map((f) => {
          const total = f.valor === "todos" ? veiculos.length : contagem[f.valor] ?? 0;
          return (
            <button
              key={f.valor}
              onClick={() => setFiltro(f.valor)}
              className={[
                "rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
                filtro === f.valor
                  ? "bg-brand text-brand-contrast"
                  : "bg-surface text-content-muted hover:bg-surface-muted",
              ].join(" ")}
            >
              {f.rotulo} ({total})
            </button>
          );
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <div className="h-[520px]">
          <Mapa
            veiculos={visiveis}
            rastro={rastro}
            aoSelecionar={verRastro}
            aoPreparar={(centralizar) => {
              centralizarRef.current = centralizar;
            }}
          />
        </div>

        <div className="space-y-3">
          {selecionado && (
            <button
              onClick={limparRastro}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-brand px-3 py-2 text-sm font-medium text-brand hover:bg-brand-light"
            >
              <Route size={16} /> Ocultar trajeto
            </button>
          )}

          {visiveis.length === 0 ? (
            <Card>
              <CardBody>
                <p className="text-sm text-content-muted">
                  Nenhum veículo neste filtro.
                </p>
              </CardBody>
            </Card>
          ) : (
            visiveis.map((v) => (
              <CartaoVeiculo
                key={v.veiculo_id}
                veiculo={v}
                selecionado={selecionado === v.veiculo_id}
                aoTocar={() => void verRastro(v.veiculo_id)}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function CartaoVeiculo({
  veiculo,
  selecionado,
  aoTocar,
}: {
  veiculo: VeiculoNoMapa;
  selecionado: boolean;
  aoTocar: () => void;
}) {
  const cor = CORES_RASTREAMENTO[veiculo.rastreamento];
  const semPosicao = veiculo.lat === null;

  return (
    <button
      onClick={aoTocar}
      disabled={semPosicao}
      className={[
        "w-full rounded-card border bg-surface p-4 text-left transition-colors",
        selecionado ? "border-brand ring-1 ring-brand" : "border-surface-border",
        semPosicao ? "opacity-60" : "hover:bg-surface-muted",
      ].join(" ")}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-bold text-content">{veiculo.placa}</span>
        <span
          className="rounded-full px-2 py-0.5 text-[11px] font-semibold"
          style={{ color: cor, backgroundColor: `${cor}1a` }}
        >
          {rotuloStatus(veiculo.rastreamento)}
        </span>
      </div>
      <p className="mt-0.5 text-sm text-content-muted">{veiculo.modelo}</p>

      {veiculo.motorista_nome && (
        <p className="mt-2 text-sm text-content">{veiculo.motorista_nome}</p>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-content-muted">
        {veiculo.velocidade_kmh !== null && (
          <span>{Math.round(Number(veiculo.velocidade_kmh))} km/h</span>
        )}
        {veiculo.idade_segundos !== null && (
          <span>{descreverIdade(veiculo.idade_segundos)}</span>
        )}
        {veiculo.atendimento_status && (
          <span className="font-medium text-brand">Em atendimento</span>
        )}
      </div>

      {semPosicao ? (
        <p className="mt-2 flex items-center gap-1 text-xs text-content-muted">
          <MapPin size={13} /> Nunca enviou posição
        </p>
      ) : (
        // Coordenada visível: ajuda a conferir o dado sem abrir o console e
        // é o que o operador informa ao telefone quando precisa orientar o
        // motorista perdido.
        <p className="mt-2 font-mono text-[11px] text-content-muted">
          {Number(veiculo.lat).toFixed(5)}, {Number(veiculo.lng).toFixed(5)}
        </p>
      )}
    </button>
  );
}

/** "há 12 s", "há 4 min", "há 2 h" — mais legível que um horário absoluto. */
function descreverIdade(segundos: number): string {
  if (segundos < 60) return `há ${Math.round(segundos)} s`;
  if (segundos < 3600) return `há ${Math.round(segundos / 60)} min`;
  return `há ${Math.round(segundos / 3600)} h`;
}
