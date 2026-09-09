"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Equal, XCircle } from "lucide-react";

import { api } from "@/lib/api";
import {
  AtendimentoDetalhe,
  Chamado,
  Usuario,
  Veiculo,
} from "@/types/api";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Spinner } from "@/components/ui/Spinner";

interface Props {
  atendimentoId: string;
  chamado?: Chamado;
  veiculo?: Veiculo;
  motorista?: Usuario;
  aoFechar: () => void;
  aoConcluir: () => void;
}

/**
 * Conferência e validação manual dos cálculos (RF10).
 *
 * A ideia do requisito é que o operador **não confie cegamente** no número
 * calculado. Por isso a tela mostra, lado a lado:
 *
 *  - o valor **armazenado**, gravado quando o motorista registrou o marco;
 *  - o valor **recalculado agora**, a partir dos mesmos marcos.
 *
 * Divergência entre os dois indica que algo mudou depois da gravação — e é
 * exatamente o que o operador precisa ver antes de assinar embaixo. O
 * backend também devolve uma lista de inconsistências detectadas
 * automaticamente (km retroativa, horários fora de ordem, velocidade média
 * implausível), que aparecem em destaque.
 *
 * Quando o operador ajusta um valor, o original **não é sobrescrito**: o
 * ajuste vai para um campo próprio, com justificativa. Um relatório precisa
 * poder mostrar o que o sistema calculou e o que a Central corrigiu.
 */
export function ValidarAtendimentoModal({
  atendimentoId,
  chamado,
  veiculo,
  motorista,
  aoFechar,
  aoConcluir,
}: Props) {
  const [detalhe, setDetalhe] = useState<AtendimentoDetalhe | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const [ajustarValores, setAjustarValores] = useState(false);
  const [kmAjustado, setKmAjustado] = useState("");
  const [tempoAjustado, setTempoAjustado] = useState("");
  const [observacao, setObservacao] = useState("");

  const carregar = useCallback(async () => {
    try {
      const d = await api<AtendimentoDetalhe>(`/atendimentos/${atendimentoId}`);
      setDetalhe(d);
      setKmAjustado(
        d.atendimento.km_total_ajustado?.toString() ??
          d.atendimento.distancia_total_km?.toString() ??
          "",
      );
      setTempoAjustado(
        d.atendimento.tempo_total_ajustado_min?.toString() ??
          d.atendimento.tempo_total_min?.toString() ??
          "",
      );
      setObservacao(d.atendimento.observacao_validacao ?? "");
      setAjustarValores(
        d.atendimento.km_total_ajustado !== null ||
          d.atendimento.tempo_total_ajustado_min !== null,
      );
      setErro(null);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao carregar o atendimento.");
    } finally {
      setCarregando(false);
    }
  }, [atendimentoId]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function validar(aprovado: boolean) {
    // Recusar exige explicação: sem o motivo, o registro não serve para nada
    // depois — nem para corrigir o processo, nem para conversar com o motorista.
    if (!aprovado && observacao.trim().length === 0) {
      setErro("Descreva o motivo ao marcar o atendimento como não validado.");
      return;
    }

    setSalvando(true);
    setErro(null);
    try {
      await api(`/atendimentos/${atendimentoId}/validar`, {
        method: "POST",
        body: JSON.stringify({
          aprovado,
          observacao: observacao.trim() || undefined,
          km_total_ajustado:
            ajustarValores && kmAjustado !== "" ? Number(kmAjustado) : undefined,
          tempo_total_ajustado_min:
            ajustarValores && tempoAjustado !== ""
              ? Number(tempoAjustado)
              : undefined,
        }),
      });
      aoConcluir();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao validar.");
      setSalvando(false);
    }
  }

  return (
    <Modal aberto aoFechar={aoFechar} titulo="Conferir atendimento">
      {carregando ? (
        <div className="grid h-40 place-items-center">
          <Spinner />
        </div>
      ) : !detalhe ? (
        <p className="text-sm text-prioridade-critica">{erro}</p>
      ) : (
        <div className="space-y-5">
          {/* Contexto */}
          <div className="rounded-lg bg-surface-muted p-4 text-sm">
            <p className="font-semibold text-content">
              {chamado?.natureza ?? "Atendimento"}
            </p>
            <p className="mt-1 text-content-muted">
              {veiculo?.placa ?? "—"} · {motorista?.nome ?? "—"}
            </p>
          </div>

          {/* Inconsistências detectadas automaticamente */}
          {!detalhe.conferencia.consistente && (
            <div className="rounded-lg border border-prioridade-critica/40 bg-prioridade-critica/5 p-4">
              <p className="flex items-center gap-2 text-sm font-semibold text-prioridade-critica">
                <AlertTriangle size={16} /> Inconsistências encontradas
              </p>
              <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-prioridade-critica">
                {detalhe.conferencia.problemas.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Marcos registrados */}
          <section>
            <h3 className="mb-2 text-sm font-semibold text-content">
              Marcos registrados pelo motorista
            </h3>
            <dl className="grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
              <Marco rotulo="Saída" km={detalhe.atendimento.km_saida} quando={detalhe.atendimento.inicio_em} />
              <Marco rotulo="Chegada ao local" km={detalhe.atendimento.km_local} quando={detalhe.atendimento.chegada_local_em} />
              <Marco rotulo="Início do transporte" km={null} quando={detalhe.atendimento.inicio_transporte_em} />
              <Marco rotulo="Conclusão" km={detalhe.atendimento.km_final} quando={detalhe.atendimento.fim_em} />
            </dl>
          </section>

          {/* Comparativo armazenado × recalculado */}
          <section>
            <h3 className="mb-2 text-sm font-semibold text-content">
              Armazenado × recalculado agora
            </h3>
            <div className="overflow-hidden rounded-lg border border-surface-border">
              <table className="w-full text-sm">
                <thead className="bg-surface-muted text-left text-xs uppercase tracking-wide text-content-muted">
                  <tr>
                    <th className="px-3 py-2 font-medium">Métrica</th>
                    <th className="px-3 py-2 font-medium">Armazenado</th>
                    <th className="px-3 py-2 font-medium">Recalculado</th>
                    <th className="px-3 py-2 font-medium" />
                  </tr>
                </thead>
                <tbody>
                  <LinhaComparativo
                    rotulo="Distância total"
                    unidade="km"
                    armazenado={detalhe.atendimento.distancia_total_km}
                    recalculado={detalhe.metricas_recalculadas.distancia_total_km}
                  />
                  <LinhaComparativo
                    rotulo="Até o local"
                    unidade="km"
                    armazenado={detalhe.atendimento.distancia_ate_local_km}
                    recalculado={detalhe.metricas_recalculadas.distancia_ate_local_km}
                  />
                  <LinhaComparativo
                    rotulo="Tempo de resposta"
                    unidade="min"
                    armazenado={detalhe.atendimento.tempo_resposta_min}
                    recalculado={detalhe.metricas_recalculadas.tempo_resposta_min}
                  />
                  <LinhaComparativo
                    rotulo="Tempo no local"
                    unidade="min"
                    armazenado={detalhe.atendimento.tempo_no_local_min}
                    recalculado={detalhe.metricas_recalculadas.tempo_no_local_min}
                  />
                  <LinhaComparativo
                    rotulo="Tempo total"
                    unidade="min"
                    armazenado={detalhe.atendimento.tempo_total_min}
                    recalculado={detalhe.metricas_recalculadas.tempo_total_min}
                  />
                </tbody>
              </table>
            </div>
          </section>

          {/* Ajuste manual */}
          <section className="space-y-3">
            <label className="flex items-center gap-2 text-sm font-medium text-content">
              <input
                type="checkbox"
                checked={ajustarValores}
                onChange={(e) => setAjustarValores(e.target.checked)}
                className="h-4 w-4 accent-[color:var(--brand)]"
              />
              Corrigir os valores manualmente
            </label>

            {ajustarValores && (
              <>
                <p className="text-xs text-content-muted">
                  O valor calculado pelo sistema é preservado; a correção fica
                  registrada em separado, com o seu nome e a justificativa.
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Input
                    label="Distância total corrigida (km)"
                    type="number"
                    min={0}
                    value={kmAjustado}
                    onChange={(e) => setKmAjustado(e.target.value)}
                  />
                  <Input
                    label="Tempo total corrigido (min)"
                    type="number"
                    min={0}
                    value={tempoAjustado}
                    onChange={(e) => setTempoAjustado(e.target.value)}
                  />
                </div>
              </>
            )}

            <Textarea
              label="Observação da conferência"
              rows={3}
              maxLength={1000}
              placeholder="Obrigatória ao não validar. Ex.: hodômetro fotografado não confere com o valor digitado."
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
            />
          </section>

          {erro && <p className="text-sm text-prioridade-critica">{erro}</p>}

          {detalhe.atendimento.validado_em && (
            <p className="text-xs text-content-muted">
              Conferido anteriormente em{" "}
              {new Date(detalhe.atendimento.validado_em).toLocaleString("pt-BR")}.
            </p>
          )}

          <div className="flex flex-wrap justify-end gap-3">
            <Button variante="secundario" onClick={aoFechar} disabled={salvando}>
              Cancelar
            </Button>
            <Button
              variante="perigo"
              onClick={() => void validar(false)}
              carregando={salvando}
            >
              <XCircle size={16} /> Não validar
            </Button>
            <Button onClick={() => void validar(true)} carregando={salvando}>
              <CheckCircle2 size={16} /> Validar
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

function Marco({
  rotulo,
  km,
  quando,
}: {
  rotulo: string;
  km: number | null;
  quando: string | null;
}) {
  return (
    <div className="flex justify-between gap-3 border-b border-surface-border py-1.5 last:border-0">
      <dt className="text-content-muted">{rotulo}</dt>
      <dd className="text-right text-content">
        {quando ? new Date(quando).toLocaleTimeString("pt-BR", {
          hour: "2-digit",
          minute: "2-digit",
        }) : "—"}
        {km !== null && <span className="ml-2 font-medium">{km} km</span>}
      </dd>
    </div>
  );
}

/**
 * Linha do comparativo. Diferença entre armazenado e recalculado é o sinal
 * de alerta que justifica a existência do RF10.
 */
function LinhaComparativo({
  rotulo,
  unidade,
  armazenado,
  recalculado,
}: {
  rotulo: string;
  unidade: string;
  armazenado: number | null;
  recalculado: number | null;
}) {
  const iguais = Number(armazenado) === Number(recalculado);
  const ambosVazios = armazenado === null && recalculado === null;

  return (
    <tr className="border-t border-surface-border">
      <td className="px-3 py-2 text-content-muted">{rotulo}</td>
      <td className="px-3 py-2 font-medium text-content">
        {armazenado !== null ? `${armazenado} ${unidade}` : "—"}
      </td>
      <td className="px-3 py-2 font-medium text-content">
        {recalculado !== null ? `${recalculado} ${unidade}` : "—"}
      </td>
      <td className="px-3 py-2">
        {ambosVazios ? null : iguais ? (
          <span className="flex items-center gap-1 text-xs text-status-disponivel">
            <Equal size={13} /> confere
          </span>
        ) : (
          <span className="flex items-center gap-1 text-xs font-semibold text-prioridade-critica">
            <AlertTriangle size={13} /> diverge
          </span>
        )}
      </td>
    </tr>
  );
}
