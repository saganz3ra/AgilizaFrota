"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { ItemChecklist, TurnoDetalhe } from "@/types/api";
import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";
import { Spinner } from "@/components/ui/Spinner";

interface Props {
  turnoId: string | null;
  aoFechar: () => void;
  itensCatalogo: ItemChecklist[];
  nomeMotorista: string;
  placaVeiculo: string;
}

/** Detalhe de um turno com o checklist executado. */
export function TurnoDetalheModal({ turnoId, aoFechar, itensCatalogo, nomeMotorista, placaVeiculo }: Props) {
  const [dados, setDados] = useState<TurnoDetalhe | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!turnoId) return;
    let ativo = true;
    setCarregando(true);
    setErro(null);
    setDados(null);
    (async () => {
      try {
        const d = await api<TurnoDetalhe>(`/turnos/${turnoId}`);
        if (ativo) setDados(d);
      } catch (e) {
        if (ativo) setErro(e instanceof ApiError ? e.message : "Falha ao carregar o turno.");
      } finally {
        if (ativo) setCarregando(false);
      }
    })();
    return () => {
      ativo = false;
    };
  }, [turnoId]);

  const descricaoItem = (codigo: string) =>
    itensCatalogo.find((i) => i.codigo === codigo)?.descricao ?? codigo;

  return (
    <Modal aberto={turnoId !== null} aoFechar={aoFechar} titulo="Detalhes do turno">
      {carregando ? (
        <div className="flex h-40 items-center justify-center">
          <Spinner />
        </div>
      ) : erro ? (
        <p className="text-sm text-prioridade-critica">{erro}</p>
      ) : dados ? (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <Info rotulo="Motorista" valor={nomeMotorista} />
            <Info rotulo="Veículo" valor={placaVeiculo} />
            <Info rotulo="Km inicial" valor={dados.turno.km_inicial.toLocaleString("pt-BR")} />
            <Info
              rotulo="Km final"
              valor={dados.turno.km_final !== null ? dados.turno.km_final.toLocaleString("pt-BR") : "—"}
            />
            <Info rotulo="Início" valor={new Date(dados.turno.inicio_em).toLocaleString("pt-BR")} />
            <Info
              rotulo="Fim"
              valor={dados.turno.fim_em ? new Date(dados.turno.fim_em).toLocaleString("pt-BR") : "—"}
            />
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-content">Checklist</h3>
              {dados.checklist && (
                <Badge tom={dados.checklist.aprovado ? "disponivel" : "critica"}>
                  {dados.checklist.aprovado ? "Aprovado" : "Reprovado"}
                </Badge>
              )}
            </div>
            {dados.checklist ? (
              <ul className="divide-y divide-surface-border rounded-lg border border-surface-border">
                {dados.checklist.respostas.map((r) => (
                  <li key={r.codigo} className="flex items-start gap-2 px-3 py-2 text-sm">
                    {r.conforme ? (
                      <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-status-disponivel" />
                    ) : (
                      <XCircle size={18} className="mt-0.5 shrink-0 text-prioridade-critica" />
                    )}
                    <div>
                      <p className="text-content">{descricaoItem(r.codigo)}</p>
                      {r.observacao && <p className="text-xs text-content-muted">{r.observacao}</p>}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-content-muted">Sem checklist associado.</p>
            )}
          </div>
        </div>
      ) : null}
    </Modal>
  );
}

function Info({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div>
      <p className="text-xs text-content-muted">{rotulo}</p>
      <p className="font-medium text-content">{valor}</p>
    </div>
  );
}
