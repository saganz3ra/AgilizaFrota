"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Clock, RefreshCw } from "lucide-react";

import { api } from "@/lib/api";
import {
  Atendimento,
  StatusAtendimento,
  Chamado,
  Usuario,
  Veiculo,
} from "@/types/api";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { ValidarAtendimentoModal } from "@/components/atendimentos/ValidarAtendimentoModal";

const ROTULO_STATUS: Record<StatusAtendimento, string> = {
  a_caminho: "A caminho",
  no_local: "No local",
  em_transporte: "Em transporte",
  concluido: "Concluído",
  cancelado: "Cancelado",
};

const TOM_STATUS: Record<StatusAtendimento, string> = {
  a_caminho: "bg-brand-light text-brand",
  no_local: "bg-brand-light text-brand",
  em_transporte: "bg-brand-light text-brand",
  concluido: "bg-status-disponivel/10 text-status-disponivel",
  cancelado: "bg-surface-muted text-content-muted",
};

type Filtro = "pendentes" | "em_andamento" | "validados" | "todos";

/**
 * Atendimentos e validação manual (RF09 / RF10).
 *
 * O RF10 — "permitir a validação manual dos cálculos realizados pelo sistema"
 * — é exclusivo da Central, e esta é a tela que o torna executável. Sem ela o
 * requisito existia apenas como endpoint, o que na prática significa que
 * ninguém o usaria.
 *
 * O filtro padrão é **"aguardando validação"**: a fila de trabalho de quem
 * confere. Um atendimento concluído e não validado é uma pendência real da
 * Central, não apenas um registro no histórico.
 */
export default function AtendimentosPage() {
  const [atendimentos, setAtendimentos] = useState<Atendimento[]>([]);
  const [chamados, setChamados] = useState<Record<string, Chamado>>({});
  const [veiculos, setVeiculos] = useState<Record<string, Veiculo>>({});
  const [motoristas, setMotoristas] = useState<Record<string, Usuario>>({});
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<Filtro>("pendentes");
  const [validando, setValidando] = useState<Atendimento | null>(null);

  const carregar = useCallback(async () => {
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
      setErro(null);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao carregar os atendimentos.");
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const visiveis = useMemo(() => {
    switch (filtro) {
      case "pendentes":
        return atendimentos.filter((a) => a.status === "concluido" && !a.validado);
      case "em_andamento":
        return atendimentos.filter((a) =>
          ["a_caminho", "no_local", "em_transporte"].includes(a.status),
        );
      case "validados":
        return atendimentos.filter((a) => a.validado);
      default:
        return atendimentos;
    }
  }, [atendimentos, filtro]);

  const contagem = useMemo(
    () => ({
      pendentes: atendimentos.filter((a) => a.status === "concluido" && !a.validado).length,
      em_andamento: atendimentos.filter((a) =>
        ["a_caminho", "no_local", "em_transporte"].includes(a.status),
      ).length,
      validados: atendimentos.filter((a) => a.validado).length,
      todos: atendimentos.length,
    }),
    [atendimentos],
  );

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
          <h1 className="text-2xl font-bold text-content">Atendimentos</h1>
          <p className="text-sm text-content-muted">
            Andamento dos atendimentos e conferência dos cálculos.
          </p>
        </div>
        <Button variante="secundario" onClick={() => void carregar()}>
          <RefreshCw size={16} /> Atualizar
        </Button>
      </div>

      {erro && (
        <Card>
          <CardBody>
            <p className="text-sm text-prioridade-critica">{erro}</p>
          </CardBody>
        </Card>
      )}

      <div className="flex flex-wrap gap-2">
        {(
          [
            ["pendentes", "Aguardando validação"],
            ["em_andamento", "Em andamento"],
            ["validados", "Validados"],
            ["todos", "Todos"],
          ] as [Filtro, string][]
        ).map(([valor, rotulo]) => (
          <button
            key={valor}
            onClick={() => setFiltro(valor)}
            className={[
              "rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
              filtro === valor
                ? "bg-brand text-brand-contrast"
                : "bg-surface text-content-muted hover:bg-surface-muted",
            ].join(" ")}
          >
            {rotulo} ({contagem[valor]})
          </button>
        ))}
      </div>

      {visiveis.length === 0 ? (
        <Card>
          <CardBody>
            <p className="py-6 text-center text-sm text-content-muted">
              {filtro === "pendentes"
                ? "Nenhum atendimento aguardando validação."
                : "Nenhum atendimento neste filtro."}
            </p>
          </CardBody>
        </Card>
      ) : (
        <div className="overflow-x-auto rounded-card border border-surface-border bg-surface">
          <table className="w-full text-sm">
            <thead className="border-b border-surface-border text-left text-content-muted">
              <tr>
                <th className="px-4 py-3 font-medium">Ocorrência</th>
                <th className="px-4 py-3 font-medium">Veículo</th>
                <th className="px-4 py-3 font-medium">Motorista</th>
                <th className="px-4 py-3 font-medium">Km</th>
                <th className="px-4 py-3 font-medium">Tempo</th>
                <th className="px-4 py-3 font-medium">Situação</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {visiveis.map((a) => {
                const chamado = chamados[a.chamado_id];
                const veiculo = veiculos[a.veiculo_id];
                const motorista = motoristas[a.motorista_id];
                const podeValidar = a.status === "concluido";

                return (
                  <tr
                    key={a.id}
                    className="border-b border-surface-border last:border-0"
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium text-content">
                        {chamado?.natureza ?? "—"}
                      </p>
                      <p className="text-xs text-content-muted">
                        {momento(a.inicio_em)}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-content">
                      {veiculo?.placa ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-content">
                      {motorista?.nome ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-content">
                      {a.distancia_total_km !== null
                        ? `${a.distancia_total_km} km`
                        : "—"}
                      {a.km_total_ajustado !== null && (
                        <span className="ml-1 text-xs text-prioridade-alta">
                          (ajustado: {a.km_total_ajustado})
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-content">
                      {a.tempo_total_min !== null ? `${a.tempo_total_min} min` : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={[
                          "rounded-full px-2.5 py-0.5 text-xs font-semibold",
                          TOM_STATUS[a.status],
                        ].join(" ")}
                      >
                        {ROTULO_STATUS[a.status]}
                      </span>
                      {a.status === "concluido" && (
                        <span className="ml-2 inline-flex items-center gap-1 text-xs">
                          {a.validado ? (
                            <>
                              <CheckCircle2
                                size={13}
                                className="text-status-disponivel"
                              />
                              <span className="text-status-disponivel">
                                validado
                              </span>
                            </>
                          ) : (
                            <>
                              <Clock size={13} className="text-prioridade-alta" />
                              <span className="text-prioridade-alta">
                                a conferir
                              </span>
                            </>
                          )}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {podeValidar && (
                        <button
                          onClick={() => setValidando(a)}
                          className="whitespace-nowrap text-sm font-medium text-brand hover:underline"
                        >
                          {a.validado ? "Rever" : "Conferir"}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {contagem.pendentes > 0 && filtro !== "pendentes" && (
        <p className="flex items-center gap-2 text-sm text-prioridade-alta">
          <AlertTriangle size={16} />
          {contagem.pendentes} atendimento(s) concluído(s) ainda sem conferência.
        </p>
      )}

      {validando && (
        <ValidarAtendimentoModal
          atendimentoId={validando.id}
          chamado={chamados[validando.chamado_id]}
          veiculo={veiculos[validando.veiculo_id]}
          motorista={motoristas[validando.motorista_id]}
          aoFechar={() => setValidando(null)}
          aoConcluir={() => {
            setValidando(null);
            void carregar();
          }}
        />
      )}
    </div>
  );
}

function momento(valor: string): string {
  const d = new Date(valor);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString("pt-BR");
}
