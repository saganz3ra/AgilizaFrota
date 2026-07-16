"use client";

import { FormEvent, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { Chamado, TipoChamado, PrioridadeChamado } from "@/types/api";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { Button } from "@/components/ui/Button";

interface Props {
  aberto: boolean;
  aoFechar: () => void;
  aoCriar: (chamado: Chamado) => void;
}

/** Formulário de abertura de chamado pela Central (RF05). */
export function NovoChamadoModal({ aberto, aoFechar, aoCriar }: Props) {
  const [tipo, setTipo] = useState<TipoChamado>("emergencia");
  const [prioridade, setPrioridade] = useState<PrioridadeChamado | "auto">("auto");
  const [natureza, setNatureza] = useState("");
  const [descricao, setDescricao] = useState("");
  const [origem, setOrigem] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  function limpar() {
    setTipo("emergencia");
    setPrioridade("auto");
    setNatureza("");
    setDescricao("");
    setOrigem("");
    setErro(null);
  }

  async function aoEnviar(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setEnviando(true);
    try {
      const corpo: Record<string, unknown> = { tipo, natureza };
      if (prioridade !== "auto") corpo.prioridade = prioridade;
      if (descricao.trim()) corpo.descricao = descricao.trim();
      if (origem.trim()) corpo.origem_endereco = origem.trim();

      const { chamado } = await api<{ chamado: Chamado }>("/chamados", {
        method: "POST",
        body: JSON.stringify(corpo),
      });
      aoCriar(chamado);
      limpar();
      aoFechar();
    } catch (err) {
      setErro(err instanceof ApiError ? err.message : "Não foi possível abrir o chamado.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Modal aberto={aberto} aoFechar={aoFechar} titulo="Novo chamado">
      <form onSubmit={aoEnviar} className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-4">
          <Select
            label="Tipo"
            value={tipo}
            onChange={(e) => setTipo(e.target.value as TipoChamado)}
            opcoes={[
              { valor: "emergencia", rotulo: "Emergência" },
              { valor: "urgencia", rotulo: "Urgência" },
            ]}
          />
          <Select
            label="Prioridade"
            value={prioridade}
            onChange={(e) => setPrioridade(e.target.value as PrioridadeChamado | "auto")}
            opcoes={[
              { valor: "auto", rotulo: "Automática (pelo tipo)" },
              { valor: "critica", rotulo: "Crítica" },
              { valor: "alta", rotulo: "Alta" },
              { valor: "media", rotulo: "Média" },
              { valor: "baixa", rotulo: "Baixa" },
            ]}
          />
        </div>

        <Input
          label="Natureza do atendimento"
          value={natureza}
          onChange={(e) => setNatureza(e.target.value)}
          placeholder="Ex.: AVC suspeito, queda com fratura..."
          required
          minLength={3}
        />

        <Input
          label="Endereço de origem (opcional)"
          value={origem}
          onChange={(e) => setOrigem(e.target.value)}
          placeholder="Rua, número, bairro"
        />

        <Textarea
          label="Descrição (opcional)"
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          placeholder="Detalhes adicionais do chamado"
        />

        {erro && (
          <p className="rounded-lg bg-prioridade-critica/10 px-3 py-2 text-sm text-prioridade-critica">
            {erro}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <Button type="button" variante="secundario" onClick={aoFechar}>
            Cancelar
          </Button>
          <Button type="submit" carregando={enviando}>
            Abrir chamado
          </Button>
        </div>
      </form>
    </Modal>
  );
}
