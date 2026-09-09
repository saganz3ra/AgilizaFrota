"use client";

import { useCallback, useEffect, useState } from "react";
import { Ambulance, Award, MapPin, UserCheck, XCircle } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { Atribuicao, Chamado, SugestaoVeiculo, Usuario, Veiculo } from "@/types/api";
import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";

interface Props {
  chamado: Chamado | null;
  aoFechar: () => void;
  aoAtualizar: (chamado: Chamado) => void;
}

/**
 * Acionamento de veículo para um chamado (RF07) com as sugestões do
 * sistema (RF08). A decisão é do operador: as sugestões apenas ordenam
 * os candidatos e explicam os motivos de cada pontuação.
 */
export function AtribuirModal({ chamado, aoFechar, aoAtualizar }: Props) {
  const [sugestoes, setSugestoes] = useState<SugestaoVeiculo[]>([]);
  const [atribuicoes, setAtribuicoes] = useState<Atribuicao[]>([]);
  const [veiculos, setVeiculos] = useState<Veiculo[]>([]);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [enviando, setEnviando] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const chamadoId = chamado?.id ?? null;

  const carregar = useCallback(async () => {
    if (!chamadoId) return;
    setCarregando(true);
    setErro(null);
    try {
      const [s, a, v, u] = await Promise.all([
        api<{ sugestoes: SugestaoVeiculo[] }>(`/chamados/${chamadoId}/sugestoes`),
        api<{ atribuicoes: Atribuicao[] }>(`/chamados/${chamadoId}/atribuicoes`),
        api<{ veiculos: Veiculo[] }>("/veiculos"),
        api<{ usuarios: Usuario[] }>("/usuarios?papel=motorista"),
      ]);
      setSugestoes(s.sugestoes);
      setAtribuicoes(a.atribuicoes);
      setVeiculos(v.veiculos);
      setUsuarios(u.usuarios);
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : "Falha ao carregar as sugestões.");
    } finally {
      setCarregando(false);
    }
  }, [chamadoId]);

  useEffect(() => {
    if (chamadoId) void carregar();
  }, [chamadoId, carregar]);

  const ativa = atribuicoes.find((a) => a.status === "ativa") || null;
  const placa = (id: string) => veiculos.find((v) => v.id === id)?.placa ?? "veículo";
  const nomeMotorista = (id: string | null) =>
    id ? usuarios.find((u) => u.id === id)?.nome ?? "motorista" : "sem motorista definido";

  async function acionar(s: SugestaoVeiculo) {
    if (!chamadoId) return;
    setEnviando(s.veiculo_id);
    setErro(null);
    try {
      const r = await api<{ chamado: Chamado }>(`/chamados/${chamadoId}/atribuir`, {
        method: "POST",
        body: JSON.stringify({
          veiculo_id: s.veiculo_id,
          ...(s.motorista_id ? { motorista_id: s.motorista_id } : {}),
          origem: "sugestao",
        }),
      });
      aoAtualizar(r.chamado);
      await carregar();
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : "Não foi possível acionar o veículo.");
    } finally {
      setEnviando(null);
    }
  }

  async function cancelarAcionamento() {
    if (!chamadoId) return;
    setEnviando("cancelar");
    setErro(null);
    try {
      const r = await api<{ chamado: Chamado }>(`/chamados/${chamadoId}/atribuicao/cancelar`, {
        method: "POST",
        body: JSON.stringify({ motivo: "Cancelado pela central" }),
      });
      aoAtualizar(r.chamado);
      await carregar();
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : "Não foi possível cancelar o acionamento.");
    } finally {
      setEnviando(null);
    }
  }

  return (
    <Modal aberto={chamado !== null} aoFechar={aoFechar} titulo="Acionar veículo">
      {chamado && (
        <p className="mb-4 text-sm text-content-muted">
          <span className="font-medium text-content">{chamado.natureza}</span> ·{" "}
          <span className="capitalize">{chamado.tipo}</span> · prioridade {chamado.prioridade}
        </p>
      )}

      {erro && (
        <p className="mb-3 rounded-lg bg-prioridade-critica/10 px-3 py-2 text-sm text-prioridade-critica">
          {erro}
        </p>
      )}

      {carregando ? (
        <div className="flex h-40 items-center justify-center">
          <Spinner />
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {ativa && (
            <div className="rounded-card border border-status-uso/40 bg-status-uso/5 p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Ambulance size={18} className="text-status-uso" />
                  <div>
                    <p className="text-sm font-semibold text-content">
                      Acionado: {placa(ativa.veiculo_id)}
                    </p>
                    <p className="text-xs text-content-muted">
                      {nomeMotorista(ativa.motorista_id)} ·{" "}
                      {new Date(ativa.atribuido_em).toLocaleString("pt-BR")}
                    </p>
                  </div>
                </div>
                <Button
                  variante="secundario"
                  tamanho="sm"
                  carregando={enviando === "cancelar"}
                  onClick={() => void cancelarAcionamento()}
                >
                  <XCircle size={16} />
                  Liberar
                </Button>
              </div>
            </div>
          )}

          <div>
            <h3 className="mb-2 text-sm font-semibold text-content">
              {ativa ? "Trocar por outro veículo" : "Veículos sugeridos"}
            </h3>

            {sugestoes.length === 0 ? (
              <p className="rounded-lg border border-surface-border px-3 py-6 text-center text-sm text-content-muted">
                Nenhum veículo disponível no momento (todos em uso, em manutenção ou já acionados).
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {sugestoes.map((s, i) => (
                  <li
                    key={s.veiculo_id}
                    className={[
                      "rounded-card border p-3",
                      i === 0 ? "border-brand/40 bg-brand-light/40" : "border-surface-border",
                    ].join(" ")}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-content">{s.placa}</p>
                          <span className="text-xs text-content-muted">{s.modelo}</span>
                          {i === 0 && (
                            <Badge tom="uso">
                              <Award size={12} className="mr-1" />
                              Sugerido
                            </Badge>
                          )}
                        </div>
                        <p className="mt-0.5 text-xs text-content-muted">
                          {s.unidade_nome || "sem unidade"}
                          {s.distancia_km !== null && (
                            <>
                              {" · "}
                              <MapPin size={11} className="inline" /> {s.distancia_km} km
                            </>
                          )}
                        </p>
                        <ul className="mt-1.5 flex flex-col gap-0.5">
                          {s.motivos.map((m) => (
                            <li key={m} className="text-xs text-content-muted">
                              • {m}
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-2">
                        <span className="text-xs font-semibold text-brand">{s.pontuacao} pts</span>
                        <Button
                          tamanho="sm"
                          carregando={enviando === s.veiculo_id}
                          onClick={() => void acionar(s)}
                        >
                          <UserCheck size={16} />
                          Acionar
                        </Button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {atribuicoes.length > 0 && (
            <details className="text-sm">
              <summary className="cursor-pointer text-content-muted">
                Histórico de acionamentos ({atribuicoes.length})
              </summary>
              <ul className="mt-2 divide-y divide-surface-border rounded-lg border border-surface-border">
                {atribuicoes.map((a) => (
                  <li key={a.id} className="flex items-center justify-between px-3 py-2 text-xs">
                    <span className="text-content">
                      {placa(a.veiculo_id)} · {new Date(a.atribuido_em).toLocaleString("pt-BR")}
                    </span>
                    <Badge tom={a.status === "ativa" ? "uso" : "neutro"}>{a.status}</Badge>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </Modal>
  );
}
