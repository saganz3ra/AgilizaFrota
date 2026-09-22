"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Clock, MapPin, Navigation, Route as RouteIcon } from "lucide-react";

import { api, ApiError } from "@/lib/api";
import {
  Atendimento,
  Chamado,
  RotaAtendimentoResposta,
  StatusAtendimento,
  Usuario,
  Veiculo,
} from "@/types/api";
import { Card, CardBody } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Spinner } from "@/components/ui/Spinner";
import { MapaRota } from "@/components/rotas/MapaRota";

/**
 * Rota sugerida e tempo estimado de chegada (RF16 / RF17).
 *
 * Lista os atendimentos em andamento (que têm um próximo destino) e, ao
 * selecionar um, consulta `GET /atendimentos/:id/rota`: o backend calcula a
 * rota do ponto atual do veículo até a ocorrência (antes de embarcar) ou até a
 * unidade de destino (depois), com fallback local quando não há provedor de
 * mapas. Aqui exibimos o ETA (RF16) e desenhamos o trajeto no mapa (RF17).
 */

const STATUS_ATIVOS: StatusAtendimento[] = ["a_caminho", "no_local", "em_transporte"];

const ROTULO_STATUS: Record<StatusAtendimento, string> = {
  a_caminho: "A caminho",
  no_local: "No local",
  em_transporte: "Em transporte",
  concluido: "Concluído",
  cancelado: "Cancelado",
};

export default function RotasPage() {
  const [atendimentos, setAtendimentos] = useState<Atendimento[]>([]);
  const [chamados, setChamados] = useState<Record<string, Chamado>>({});
  const [veiculos, setVeiculos] = useState<Record<string, Veiculo>>({});
  const [motoristas, setMotoristas] = useState<Record<string, Usuario>>({});
  const [carregandoLista, setCarregandoLista] = useState(true);
  const [erroLista, setErroLista] = useState<string | null>(null);

  const [selecionadoId, setSelecionadoId] = useState<string | null>(null);
  const [rota, setRota] = useState<RotaAtendimentoResposta | null>(null);
  const [carregandoRota, setCarregandoRota] = useState(false);
  const [erroRota, setErroRota] = useState<string | null>(null);

  const carregarLista = useCallback(async () => {
    setCarregandoLista(true);
    try {
      const [at, ch, ve, us] = await Promise.all([
        api<{ atendimentos: Atendimento[] }>("/atendimentos"),
        api<{ chamados: Chamado[] }>("/chamados"),
        api<{ veiculos: Veiculo[] }>("/veiculos"),
        api<{ usuarios: Usuario[] }>("/usuarios?papel=motorista"),
      ]);
      setAtendimentos(at.atendimentos);
      setChamados(Object.fromEntries(ch.chamados.map((c) => [c.id, c])));
      setVeiculos(Object.fromEntries(ve.veiculos.map((v) => [v.id, v])));
      setMotoristas(Object.fromEntries(us.usuarios.map((u) => [u.id, u])));
      setErroLista(null);
    } catch (e) {
      setErroLista(mensagemErro(e));
    } finally {
      setCarregandoLista(false);
    }
  }, []);

  useEffect(() => {
    void carregarLista();
  }, [carregarLista]);

  const ativos = useMemo(
    () => atendimentos.filter((a) => STATUS_ATIVOS.includes(a.status)),
    [atendimentos],
  );

  // Busca a rota do atendimento selecionado.
  useEffect(() => {
    if (!selecionadoId) {
      setRota(null);
      setErroRota(null);
      return;
    }
    let ativo = true;
    setCarregandoRota(true);
    setErroRota(null);
    (async () => {
      try {
        const resp = await api<RotaAtendimentoResposta>(`/atendimentos/${selecionadoId}/rota`);
        if (ativo) setRota(resp);
      } catch (e) {
        if (ativo) {
          setRota(null);
          setErroRota(mensagemErro(e));
        }
      } finally {
        if (ativo) setCarregandoRota(false);
      }
    })();
    return () => {
      ativo = false;
    };
  }, [selecionadoId]);

  const pontosRota = useMemo(() => {
    if (rota?.rota?.fonte === "google" && rota.rota.polyline) {
      return decodificarPolyline(rota.rota.polyline);
    }
    return null;
  }, [rota]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-content">Rotas e ETA</h1>
        <p className="text-sm text-content-muted">
          Trajeto sugerido e tempo estimado de chegada dos atendimentos em andamento.
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
        {/* Lista de atendimentos ativos */}
        <div className="space-y-2">
          {carregandoLista ? (
            <div className="grid h-40 place-items-center">
              <Spinner />
            </div>
          ) : erroLista ? (
            <Card>
              <CardBody>
                <p className="text-sm text-prioridade-critica">{erroLista}</p>
              </CardBody>
            </Card>
          ) : ativos.length === 0 ? (
            <Card>
              <CardBody>
                <p className="py-6 text-center text-sm text-content-muted">
                  Nenhum atendimento em andamento no momento.
                </p>
              </CardBody>
            </Card>
          ) : (
            ativos.map((a) => {
              const selecionado = a.id === selecionadoId;
              return (
                <button
                  key={a.id}
                  onClick={() => setSelecionadoId(a.id)}
                  className={[
                    "w-full rounded-card border p-3 text-left transition-colors",
                    selecionado
                      ? "border-brand bg-brand-light"
                      : "border-surface-border bg-surface hover:bg-surface-muted",
                  ].join(" ")}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-content">
                      {chamados[a.chamado_id]?.natureza ?? "Atendimento"}
                    </span>
                    <Badge tom="disponivel">{ROTULO_STATUS[a.status]}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-content-muted">
                    {veiculos[a.veiculo_id]?.placa ?? "—"} ·{" "}
                    {motoristas[a.motorista_id]?.nome ?? "—"}
                  </p>
                </button>
              );
            })
          )}
        </div>

        {/* Detalhe da rota selecionada */}
        <div>
          {!selecionadoId ? (
            <Card>
              <CardBody>
                <p className="py-16 text-center text-sm text-content-muted">
                  Selecione um atendimento à esquerda para ver o trajeto e o tempo estimado.
                </p>
              </CardBody>
            </Card>
          ) : carregandoRota ? (
            <div className="grid h-[420px] place-items-center">
              <Spinner />
            </div>
          ) : erroRota ? (
            <Card>
              <CardBody>
                <p className="text-sm text-prioridade-critica">{erroRota}</p>
              </CardBody>
            </Card>
          ) : rota && rota.rota ? (
            <DetalheRota resposta={rota} pontosRota={pontosRota} />
          ) : (
            <Card>
              <CardBody>
                <p className="py-6 text-center text-sm text-content-muted">
                  Não foi possível calcular a rota deste atendimento.
                </p>
              </CardBody>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function DetalheRota({
  resposta,
  pontosRota,
}: {
  resposta: RotaAtendimentoResposta;
  pontosRota: [number, number][] | null;
}) {
  const r = resposta.rota!;
  const etapa =
    resposta.etapa === "ate_ocorrencia" ? "A caminho da ocorrência" : "Levando ao destino";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Badge tom="neutro">{etapa}</Badge>
        {r.fonte === "google" ? (
          <Badge tom="disponivel">Rota real (Google)</Badge>
        ) : (
          <Badge tom="media">Estimativa local</Badge>
        )}
        {r.degradado && <Badge tom="alta">Provedor indisponível</Badge>}
      </div>

      <div className="flex flex-wrap gap-3">
        <Card className="min-w-[150px] flex-1">
          <CardBody className="flex items-center gap-3 py-3">
            <Clock className="text-brand" size={22} />
            <div>
              <p className="text-xl font-bold text-content">{r.duracao_min} min</p>
              <p className="text-xs text-content-muted">Tempo estimado</p>
            </div>
          </CardBody>
        </Card>
        <Card className="min-w-[150px] flex-1">
          <CardBody className="flex items-center gap-3 py-3">
            <RouteIcon className="text-brand" size={22} />
            <div>
              <p className="text-xl font-bold text-content">
                {r.distancia_km.toLocaleString("pt-BR")} km
              </p>
              <p className="text-xs text-content-muted">Distância</p>
            </div>
          </CardBody>
        </Card>
        <Card className="min-w-[150px] flex-1">
          <CardBody className="flex items-center gap-3 py-3">
            <MapPin className="text-brand" size={22} />
            <div>
              <p className="text-sm font-semibold text-content">
                {resposta.destino.nome ?? "Destino"}
              </p>
              <p className="text-xs text-content-muted">Destino</p>
            </div>
          </CardBody>
        </Card>
      </div>

      <div className="h-[420px]">
        <MapaRota
          origem={{ lat: resposta.origem.lat, lng: resposta.origem.lng }}
          destino={{
            lat: resposta.destino.lat,
            lng: resposta.destino.lng,
            nome: resposta.destino.nome,
          }}
          pontosRota={pontosRota}
        />
      </div>

      {r.fonte === "estimativa" && (
        <p className="flex items-start gap-2 text-xs text-content-muted">
          <Navigation size={14} className="mt-0.5 shrink-0" />
          {r.observacao ??
            "Traçado aproximado (linha reta). Configure o provedor de mapas para a rota real por ruas."}
        </p>
      )}

      {r.passos && r.passos.length > 0 && (
        <Card>
          <CardBody>
            <p className="mb-2 text-sm font-semibold text-content">Passo a passo</p>
            <ol className="space-y-1.5 text-sm text-content-muted">
              {r.passos.map((p, i) => (
                <li key={i} className="flex justify-between gap-3">
                  <span className="text-content">
                    {i + 1}. {p.instrucao}
                  </span>
                  <span className="shrink-0 whitespace-nowrap">
                    {p.distancia_km.toLocaleString("pt-BR")} km · {p.duracao_min} min
                  </span>
                </li>
              ))}
            </ol>
          </CardBody>
        </Card>
      )}
    </div>
  );
}

/** Traduz o erro em mensagem para o operador, reagindo ao `codigo` da API. */
function mensagemErro(e: unknown): string {
  if (e instanceof ApiError) {
    switch (e.codigo) {
      case "SEM_POSICAO":
        return "O veículo ainda não enviou posição de GPS, então não dá para calcular a rota. Assim que houver um ponto no mapa, o trajeto aparece.";
      case "DESTINO_SEM_COORDENADAS":
        return "O destino deste atendimento não tem coordenadas cadastradas.";
      case "ACESSO_NEGADO":
        return "Você não tem acesso a este atendimento.";
      default:
        return e.message;
    }
  }
  return "Não foi possível conectar à API. Verifique se o backend está no ar.";
}

/**
 * Decodifica a polyline codificada do Google (formato "Encoded Polyline
 * Algorithm") em pares [lat, lng]. É o formato que `overview_polyline.points`
 * usa; sem decodificar, não há como desenhar a rua no Leaflet.
 */
function decodificarPolyline(encoded: string): [number, number][] {
  const pontos: [number, number][] = [];
  let indice = 0;
  let lat = 0;
  let lng = 0;

  while (indice < encoded.length) {
    let deslocamento = 0;
    let resultado = 0;
    let byte: number;
    do {
      byte = encoded.charCodeAt(indice++) - 63;
      resultado |= (byte & 0x1f) << deslocamento;
      deslocamento += 5;
    } while (byte >= 0x20);
    lat += resultado & 1 ? ~(resultado >> 1) : resultado >> 1;

    deslocamento = 0;
    resultado = 0;
    do {
      byte = encoded.charCodeAt(indice++) - 63;
      resultado |= (byte & 0x1f) << deslocamento;
      deslocamento += 5;
    } while (byte >= 0x20);
    lng += resultado & 1 ? ~(resultado >> 1) : resultado >> 1;

    pontos.push([lat / 1e5, lng / 1e5]);
  }
  return pontos;
}
