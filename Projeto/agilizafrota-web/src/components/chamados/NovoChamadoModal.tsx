"use client";

import { FormEvent, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { Chamado, TipoChamado, PrioridadeChamado } from "@/types/api";
import { coletar, obrigatorio, tamanho, useErrosCampo } from "@/lib/validacao";
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
  const { erros, setErros, limpar, limparTudo } = useErrosCampo();

  function resetarFormulario() {
    setTipo("emergencia");
    setPrioridade("auto");
    setNatureza("");
    setDescricao("");
    setOrigem("");
    setErro(null);
    limparTudo();
  }

  async function aoEnviar(e: FormEvent) {
    e.preventDefault();
    setErro(null);

    // Espelha chamadoValidators (corpoChamado).
    const encontrados = coletar({
      natureza:
        obrigatorio(natureza, "Natureza") ?? tamanho(natureza, { min: 3, max: 150, nome: "Natureza" }),
      origem: tamanho(origem, { max: 500, nome: "Endereço de origem" }),
      descricao: tamanho(descricao, { max: 2000, nome: "Descrição" }),
    });
    setErros(encontrados);
    if (Object.keys(encontrados).length > 0) return;

    setEnviando(true);
    try {
      const corpo: Record<string, unknown> = { tipo, natureza: natureza.trim() };
      if (prioridade !== "auto") corpo.prioridade = prioridade;
      if (descricao.trim()) corpo.descricao = descricao.trim();
      if (origem.trim()) corpo.origem_endereco = origem.trim();

      const { chamado } = await api<{ chamado: Chamado }>("/chamados", {
        method: "POST",
        body: JSON.stringify(corpo),
      });
      aoCriar(chamado);
      resetarFormulario();
      aoFechar();
    } catch (err) {
      setErro(err instanceof ApiError ? err.message : "Não foi possível abrir o chamado.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Modal aberto={aberto} aoFechar={aoFechar} titulo="Novo chamado">
      <form onSubmit={aoEnviar} noValidate className="flex flex-col gap-4">
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
          onChange={(e) => {
            setNatureza(e.target.value);
            limpar("natureza");
          }}
          placeholder="Ex.: AVC suspeito, queda com fratura..."
          erro={erros.natureza}
        />

        <Input
          label="Endereço de origem (opcional)"
          value={origem}
          onChange={(e) => {
            setOrigem(e.target.value);
            limpar("origem");
          }}
          placeholder="Rua, número, bairro"
          erro={erros.origem}
        />

        <Textarea
          label="Descrição (opcional)"
          value={descricao}
          onChange={(e) => {
            setDescricao(e.target.value);
            limpar("descricao");
          }}
          placeholder="Detalhes adicionais do chamado"
        />
        {erros.descricao && (
          <span className="-mt-2 text-sm text-prioridade-critica">{erros.descricao}</span>
        )}

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
