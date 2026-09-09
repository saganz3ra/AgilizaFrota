"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { PhoneCall, Plus, Radio, Bell, XCircle, Ambulance } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { useChamadosStream, EventoChamado } from "@/lib/useChamadosStream";
import { tocarAlerta } from "@/lib/som";
import {
  Chamado,
  PrioridadeChamado,
  StatusChamado,
} from "@/types/api";
import { Card, CardBody } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { NovoChamadoModal } from "@/components/chamados/NovoChamadoModal";
import { AtribuirModal } from "@/components/chamados/AtribuirModal";

/**
 * Formata data/hora sem nunca exibir "Invalid Date" ao operador.
 * Uma data ausente ou malformada e um defeito nosso, e a tela nao deve
 * transformar isso em ruido para quem esta atendendo uma emergencia.
 */
function formatarMomento(valor?: string | null): string {
  if (!valor) return "—";
  const data = new Date(valor);
  return Number.isNaN(data.getTime()) ? "—" : data.toLocaleString("pt-BR");
}

const RANK: Record<PrioridadeChamado, number> = { critica: 0, alta: 1, media: 2, baixa: 3 };
const TOM_PRIORIDADE: Record<PrioridadeChamado, "critica" | "alta" | "media" | "baixa"> = {
  critica: "critica",
  alta: "alta",
  media: "media",
  baixa: "baixa",
};
const ROTULO_STATUS: Record<StatusChamado, string> = {
  aberto: "Aberto",
  atribuido: "Atribuído",
  em_atendimento: "Em atendimento",
  concluido: "Concluído",
  cancelado: "Cancelado",
};
const CANCELAVEL: StatusChamado[] = ["aberto", "atribuido", "em_atendimento"];

type Filtro = "todos" | "ativos" | "encerrados";

function ordenar(lista: Chamado[]): Chamado[] {
  return [...lista].sort((a, b) => {
    const r = RANK[a.prioridade] - RANK[b.prioridade];
    if (r !== 0) return r;
    return new Date(b.aberto_em).getTime() - new Date(a.aberto_em).getTime();
  });
}

export default function ChamadosPage() {
  const [chamados, setChamados] = useState<Chamado[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<Filtro>("ativos");
  const [modalAberto, setModalAberto] = useState(false);
  const [chamadoAtribuir, setChamadoAtribuir] = useState<Chamado | null>(null);
  const [destaque, setDestaque] = useState<string | null>(null);
  const [ultimoAlerta, setUltimoAlerta] = useState<Chamado | null>(null);

  useEffect(() => {
    let ativo = true;
    (async () => {
      try {
        const { chamados: lista } = await api<{ chamados: Chamado[] }>("/chamados");
        if (ativo) setChamados(ordenar(lista));
      } catch (e) {
        if (ativo) setErro(e instanceof ApiError ? e.message : "Falha ao carregar chamados.");
      } finally {
        if (ativo) setCarregando(false);
      }
    })();
    return () => {
      ativo = false;
    };
  }, []);

  const upsert = useCallback((chamado: Chamado, novo: boolean) => {
    setChamados((atual) => {
      const existe = atual.some((c) => c.id === chamado.id);
      const lista = existe
        ? // MESCLA em vez de substituir. Um evento SSE pode trazer apenas os
          // campos que mudaram; substituir o objeto inteiro apagaria o que
          // ja sabiamos (foi assim que "aberto_em" sumia e a data virava
          // "Invalid Date"). Mesclar mantem a tela consistente mesmo que
          // algum publicador envie um payload parcial.
          atual.map((c) => (c.id === chamado.id ? { ...c, ...chamado } : c))
        : [chamado, ...atual];
      return ordenar(lista);
    });
    if (novo) {
      tocarAlerta();
      setDestaque(chamado.id);
      setUltimoAlerta(chamado);
      window.setTimeout(() => setDestaque((d) => (d === chamado.id ? null : d)), 5000);
      window.setTimeout(() => setUltimoAlerta((u) => (u?.id === chamado.id ? null : u)), 8000);
    }
  }, []);

  const aoEvento = useCallback(
    (e: EventoChamado) => upsert(e.chamado, e.tipo === "novo"),
    [upsert],
  );
  const { conectado } = useChamadosStream(aoEvento);

  async function cancelar(id: string) {
    try {
      const { chamado } = await api<{ chamado: Chamado }>(`/chamados/${id}/cancelar`, {
        method: "PATCH",
      });
      upsert(chamado, false);
    } catch {
      // erro tratado silenciosamente; o SSE tambem atualiza
    }
  }

  const visiveis = useMemo(() => {
    if (filtro === "todos") return chamados;
    if (filtro === "ativos")
      return chamados.filter((c) => CANCELAVEL.includes(c.status));
    return chamados.filter((c) => c.status === "concluido" || c.status === "cancelado");
  }, [chamados, filtro]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-content">Chamados</h1>
          <p className="flex items-center gap-2 text-sm text-content-muted">
            <Radio size={14} className={conectado ? "text-status-disponivel" : "text-content-muted"} />
            {conectado ? "Recebendo alertas em tempo real" : "Reconectando ao tempo real..."}
          </p>
        </div>
        <Button onClick={() => setModalAberto(true)}>
          <Plus size={18} />
          Novo chamado
        </Button>
      </div>

      {ultimoAlerta && (
        <div className="flex items-center gap-3 rounded-card border border-prioridade-alta/40 bg-prioridade-alta/10 px-4 py-3">
          <Bell className="text-prioridade-alta" />
          <p className="text-sm text-content">
            <span className="font-semibold">Novo chamado:</span> {ultimoAlerta.natureza} ({ultimoAlerta.tipo})
          </p>
        </div>
      )}

      <div className="flex gap-2">
        {(["ativos", "todos", "encerrados"] as Filtro[]).map((f) => (
          <button
            key={f}
            onClick={() => setFiltro(f)}
            className={[
              "rounded-full px-3 py-1.5 text-sm font-medium capitalize transition-colors",
              filtro === f
                ? "bg-brand text-brand-contrast"
                : "bg-surface text-content-muted hover:bg-surface-muted",
            ].join(" ")}
          >
            {f}
          </button>
        ))}
      </div>

      {carregando ? (
        <div className="flex h-64 items-center justify-center">
          <Spinner />
        </div>
      ) : erro ? (
        <Card>
          <CardBody>
            <p className="text-sm text-content-muted">{erro}</p>
          </CardBody>
        </Card>
      ) : visiveis.length === 0 ? (
        <Card>
          <CardBody>
            <div className="flex flex-col items-center gap-2 py-8 text-center text-content-muted">
              <PhoneCall />
              <p className="text-sm">Nenhum chamado nesta visão.</p>
            </div>
          </CardBody>
        </Card>
      ) : (
        <div className="flex flex-col gap-2">
          {visiveis.map((c) => (
            <Card
              key={c.id}
              className={destaque === c.id ? "ring-2 ring-prioridade-alta" : ""}
            >
              <CardBody className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <Badge tom={TOM_PRIORIDADE[c.prioridade]}>{c.prioridade}</Badge>
                  <div className="min-w-0">
                    <p className="truncate font-medium text-content">{c.natureza}</p>
                    <p className="text-xs text-content-muted">
                      <span className="capitalize">{c.tipo}</span>
                      {" · "}
                      {c.origem_tipo === "sistema_externo" ? "Sistema externo" : "Central"}
                      {" · "}
                      {formatarMomento(c.aberto_em)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge tom="neutro">{ROTULO_STATUS[c.status]}</Badge>
                  {CANCELAVEL.includes(c.status) && (
                    <>
                      <Button variante="secundario" tamanho="sm" onClick={() => setChamadoAtribuir(c)}>
                        <Ambulance size={16} />
                        {c.status === "aberto" ? "Acionar" : "Ver acionamento"}
                      </Button>
                      <Button variante="ghost" tamanho="sm" onClick={() => cancelar(c.id)}>
                        <XCircle size={16} />
                        Cancelar
                      </Button>
                    </>
                  )}
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      <NovoChamadoModal
        aberto={modalAberto}
        aoFechar={() => setModalAberto(false)}
        aoCriar={(c) => upsert(c, false)}
      />

      <AtribuirModal
        chamado={chamadoAtribuir}
        aoFechar={() => setChamadoAtribuir(null)}
        aoAtualizar={(c) => {
          upsert(c, false);
          setChamadoAtribuir(c);
        }}
      />
    </div>
  );
}
