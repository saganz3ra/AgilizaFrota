"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";

import { api, ApiError } from "@/lib/api";
import {
  EventoHistorico,
  HistoricoResposta,
  TipoEventoHistorico,
  Unidade,
  Usuario,
  Veiculo,
} from "@/types/api";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { Spinner } from "@/components/ui/Spinner";
import { mascaraData } from "@/lib/mascaras";
import { dataParaIso, validarIntervalo } from "@/lib/validacao";

/**
 * Histórico completo da frota e dos atendimentos (RF12).
 *
 * Consome `GET /historico`, a linha do tempo que o backend consolida a partir
 * de turnos, atendimentos e chamados. É restrita à Central (RBAC no servidor).
 *
 * Paginação: o endpoint devolve `total` = contagem da PÁGINA, não o total
 * geral. Então não dá para mostrar "página X de Y"; a navegação é por
 * offset e a existência de "próxima" é inferida de a página ter vindo cheia
 * (tamanho === limite). É a informação honesta que o backend oferece hoje.
 */

const LIMITE = 100;

const ROTULO_TIPO: Record<TipoEventoHistorico, string> = {
  turno: "Turno",
  atendimento: "Atendimento",
  chamado: "Chamado",
};

// Tom do Badge por tipo, só para diferenciar visualmente na varredura.
const TOM_TIPO: Record<TipoEventoHistorico, "neutro" | "disponivel" | "media"> = {
  turno: "neutro",
  atendimento: "disponivel",
  chamado: "media",
};

export default function HistoricoPage() {
  const [motoristaId, setMotoristaId] = useState("");
  const [veiculoId, setVeiculoId] = useState("");
  const [unidadeId, setUnidadeId] = useState("");
  const [desde, setDesde] = useState("");
  const [ate, setAte] = useState("");

  const [motoristas, setMotoristas] = useState<Usuario[]>([]);
  const [veiculos, setVeiculos] = useState<Veiculo[]>([]);
  const [unidades, setUnidades] = useState<Unidade[]>([]);

  const [eventos, setEventos] = useState<EventoHistorico[]>([]);
  const [offset, setOffset] = useState(0);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  // Opções dos filtros. Falha silenciosa: sem elas ainda dá para listar tudo.
  useEffect(() => {
    let ativo = true;
    (async () => {
      try {
        const [us, ve, un] = await Promise.all([
          api<{ usuarios: Usuario[] }>("/usuarios?papel=motorista"),
          api<{ veiculos: Veiculo[] }>("/veiculos"),
          api<{ unidades: Unidade[] }>("/unidades"),
        ]);
        if (!ativo) return;
        setMotoristas(us.usuarios);
        setVeiculos(ve.veiculos);
        setUnidades(un.unidades.filter((u) => u.ativo));
      } catch {
        /* filtros indisponíveis; não bloqueia a linha do tempo */
      }
    })();
    return () => {
      ativo = false;
    };
  }, []);

  const montarQuery = useCallback(
    (deslocamento: number): string => {
      const p = new URLSearchParams();
      if (motoristaId) p.set("motorista_id", motoristaId);
      if (veiculoId) p.set("veiculo_id", veiculoId);
      if (unidadeId) p.set("unidade_id", unidadeId);
      const isoDesde = dataParaIso(desde);
      const isoAte = dataParaIso(ate, { fimDoDia: true });
      if (isoDesde) p.set("desde", isoDesde);
      if (isoAte) p.set("ate", isoAte);
      p.set("limite", String(LIMITE));
      p.set("offset", String(deslocamento));
      return `?${p.toString()}`;
    },
    [motoristaId, veiculoId, unidadeId, desde, ate],
  );

  const carregar = useCallback(
    async (deslocamento: number) => {
      const erroData = validarIntervalo(desde, ate);
      if (erroData) {
        setErro(erroData);
        return;
      }
      setErro(null);
      setCarregando(true);
      try {
        const resp = await api<HistoricoResposta>(`/historico${montarQuery(deslocamento)}`);
        setEventos(resp.eventos);
        setOffset(deslocamento);
      } catch (e) {
        setEventos([]);
        setErro(mensagemErro(e));
      } finally {
        setCarregando(false);
      }
    },
    [desde, ate, montarQuery],
  );

  // Carga inicial: eventos mais recentes, sem filtro.
  useEffect(() => {
    void carregar(0);
    // Só na montagem: o restante é disparado por "Buscar" e pela paginação.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const temProxima = eventos.length === LIMITE;
  const temAnterior = offset > 0;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-content">Histórico</h1>
        <p className="text-sm text-content-muted">
          Linha do tempo de turnos, atendimentos e chamados, filtrável por motorista,
          veículo e período.
        </p>
      </div>

      <Card>
        <CardBody className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Select
              label="Motorista"
              value={motoristaId}
              onChange={(e) => setMotoristaId(e.target.value)}
              opcoes={[
                { valor: "", rotulo: "Todos os motoristas" },
                ...motoristas.map((m) => ({ valor: m.id, rotulo: m.nome })),
              ]}
            />
            <Select
              label="Veículo"
              value={veiculoId}
              onChange={(e) => setVeiculoId(e.target.value)}
              opcoes={[
                { valor: "", rotulo: "Todos os veículos" },
                ...veiculos.map((v) => ({ valor: v.id, rotulo: v.placa })),
              ]}
            />
            <Select
              label="Unidade de destino"
              value={unidadeId}
              onChange={(e) => setUnidadeId(e.target.value)}
              opcoes={[
                { valor: "", rotulo: "Todas as unidades" },
                ...unidades.map((u) => ({ valor: u.id, rotulo: u.nome })),
              ]}
            />
            <Input
              label="De"
              value={desde}
              inputMode="numeric"
              placeholder="DD/MM/AAAA"
              onChange={(e) => setDesde(mascaraData(e.target.value))}
            />
            <Input
              label="Até"
              value={ate}
              inputMode="numeric"
              placeholder="DD/MM/AAAA"
              onChange={(e) => setAte(mascaraData(e.target.value))}
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={() => void carregar(0)} carregando={carregando}>
              <Search size={16} /> Buscar
            </Button>
            <Button
              variante="ghost"
              onClick={() => {
                setMotoristaId("");
                setVeiculoId("");
                setUnidadeId("");
                setDesde("");
                setAte("");
              }}
              disabled={carregando}
            >
              Limpar filtros
            </Button>
          </div>
        </CardBody>
      </Card>

      {erro && (
        <Card>
          <CardBody>
            <p className="text-sm text-prioridade-critica">{erro}</p>
          </CardBody>
        </Card>
      )}

      {carregando ? (
        <div className="grid h-64 place-items-center">
          <Spinner />
        </div>
      ) : eventos.length === 0 ? (
        <Card>
          <CardBody>
            <p className="py-6 text-center text-sm text-content-muted">
              Nenhum evento encontrado para os filtros selecionados.
            </p>
          </CardBody>
        </Card>
      ) : (
        <>
          <div className="overflow-x-auto rounded-card border border-surface-border bg-surface">
            <table className="w-full text-sm">
              <thead className="border-b border-surface-border text-left text-content-muted">
                <tr>
                  <th className="whitespace-nowrap px-4 py-3 font-medium">Quando</th>
                  <th className="px-4 py-3 font-medium">Tipo</th>
                  <th className="px-4 py-3 font-medium">Evento</th>
                  <th className="px-4 py-3 font-medium">Pessoa</th>
                  <th className="px-4 py-3 font-medium">Veículo</th>
                  <th className="px-4 py-3 font-medium">Situação</th>
                  <th className="px-4 py-3 font-medium">Detalhe</th>
                </tr>
              </thead>
              <tbody>
                {eventos.map((ev) => (
                  <tr
                    key={`${ev.tipo}-${ev.id}`}
                    className="border-b border-surface-border last:border-0"
                  >
                    <td className="whitespace-nowrap px-4 py-3 text-content-muted">
                      {formatarData(ev.ocorrido_em)}
                    </td>
                    <td className="px-4 py-3">
                      <Badge tom={TOM_TIPO[ev.tipo]}>{ROTULO_TIPO[ev.tipo]}</Badge>
                    </td>
                    <td className="px-4 py-3 text-content">
                      {ev.descricao ?? ROTULO_TIPO[ev.tipo]}
                    </td>
                    <td className="px-4 py-3 text-content">{ev.pessoa ?? "—"}</td>
                    <td className="px-4 py-3 text-content">{ev.placa ?? "—"}</td>
                    <td className="px-4 py-3 text-content-muted">{ev.status}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-content-muted">
                      {detalheEvento(ev)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm text-content-muted">
              Mostrando {eventos.length} evento(s) a partir do #{offset + 1}
            </span>
            <div className="flex gap-2">
              <Button
                variante="secundario"
                tamanho="sm"
                onClick={() => void carregar(Math.max(0, offset - LIMITE))}
                disabled={!temAnterior || carregando}
              >
                <ChevronLeft size={16} /> Anterior
              </Button>
              <Button
                variante="secundario"
                tamanho="sm"
                onClick={() => void carregar(offset + LIMITE)}
                disabled={!temProxima || carregando}
              >
                Próxima <ChevronRight size={16} />
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/** Traduz o erro em mensagem para o operador, reagindo ao `codigo` da API. */
function mensagemErro(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.codigo === "ACESSO_NEGADO") return "Apenas o perfil da Central pode ver o histórico.";
    return e.message;
  }
  return "Não foi possível conectar à API. Verifique se o backend está no ar.";
}

function formatarData(valor: string): string {
  const d = new Date(valor);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString("pt-BR");
}

/** Detalhe numérico do evento — o significado de valor_a/valor_b muda por tipo. */
function detalheEvento(ev: EventoHistorico): string {
  const num = (n: number | null) => (n === null ? "—" : n.toLocaleString("pt-BR"));
  switch (ev.tipo) {
    case "turno":
      return `Km ${num(ev.valor_a)} → ${num(ev.valor_b)}`;
    case "atendimento": {
      const km = ev.valor_a === null ? "—" : `${num(ev.valor_a)} km`;
      const min = ev.valor_b === null ? "—" : `${num(ev.valor_b)} min`;
      return `${km} · ${min}`;
    }
    default:
      return "—";
  }
}
