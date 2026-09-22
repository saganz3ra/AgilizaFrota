"use client";

import { FormEvent, useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { Unidade, Veiculo, StatusVeiculo } from "@/types/api";
import {
  coletar,
  inteiroOpcional,
  obrigatorio,
  placa as validarPlaca,
  tamanho,
  useErrosCampo,
} from "@/lib/validacao";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";

interface Props {
  aberto: boolean;
  aoFechar: () => void;
  aoSalvar: (veiculo: Veiculo) => void;
  unidades: Unidade[];
  veiculo?: Veiculo | null; // quando presente, modo edição
}

const ANO_ATUAL = new Date().getFullYear();

/** Formulário de criação/edição de veículo (RF02). */
export function VeiculoModal({ aberto, aoFechar, aoSalvar, unidades, veiculo }: Props) {
  const edicao = Boolean(veiculo);
  const [placa, setPlaca] = useState("");
  const [modelo, setModelo] = useState("");
  const [marca, setMarca] = useState("");
  const [ano, setAno] = useState("");
  const [km, setKm] = useState("");
  const [status, setStatus] = useState<StatusVeiculo>("disponivel");
  const [unidadeId, setUnidadeId] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const { erros, setErros, limpar, limparTudo } = useErrosCampo();

  useEffect(() => {
    if (!aberto) return;
    setErro(null);
    limparTudo();
    setPlaca(veiculo?.placa ?? "");
    setModelo(veiculo?.modelo ?? "");
    setMarca(veiculo?.marca ?? "");
    setAno(veiculo?.ano ? String(veiculo.ano) : "");
    setKm(veiculo ? String(veiculo.quilometragem_atual) : "");
    setStatus(veiculo?.status ?? "disponivel");
    setUnidadeId(veiculo?.unidade_id ?? "");
  }, [aberto, veiculo, limparTudo]);

  async function aoEnviar(e: FormEvent) {
    e.preventDefault();
    setErro(null);

    // Camada de UX: espelha as regras baratas do backend (veiculoValidators).
    // Placa única, por exemplo, fica só no servidor — o cliente não tem como saber.
    const encontrados = coletar({
      placa: validarPlaca(placa),
      modelo: obrigatorio(modelo, "Modelo") ?? tamanho(modelo, { max: 50, nome: "Modelo" }),
      marca: tamanho(marca, { max: 30, nome: "Marca" }),
      ano: inteiroOpcional(ano, { min: 1950, max: ANO_ATUAL + 1, nome: "Ano" }),
      km: inteiroOpcional(km, { min: 0, nome: "Km atual" }),
    });
    setErros(encontrados);
    if (Object.keys(encontrados).length > 0) return;

    setEnviando(true);
    try {
      const corpo: Record<string, unknown> = {
        placa: placa.trim().toUpperCase(),
        modelo: modelo.trim(),
      };
      if (marca.trim()) corpo.marca = marca.trim();
      if (ano) corpo.ano = Number(ano);
      if (km !== "") corpo.quilometragem_atual = Number(km);
      if (unidadeId) corpo.unidade_id = unidadeId;
      if (edicao) corpo.status = status;

      const resposta = edicao
        ? await api<{ veiculo: Veiculo }>(`/veiculos/${veiculo!.id}`, {
            method: "PUT",
            body: JSON.stringify(corpo),
          })
        : await api<{ veiculo: Veiculo }>("/veiculos", {
            method: "POST",
            body: JSON.stringify(corpo),
          });
      aoSalvar(resposta.veiculo);
      aoFechar();
    } catch (err) {
      setErro(err instanceof ApiError ? err.message : "Não foi possível salvar o veículo.");
    } finally {
      setEnviando(false);
    }
  }

  const opcoesUnidade = [
    { valor: "", rotulo: "— Sem unidade —" },
    ...unidades.map((u) => ({ valor: u.id, rotulo: u.nome })),
  ];

  return (
    <Modal aberto={aberto} aoFechar={aoFechar} titulo={edicao ? "Editar veículo" : "Novo veículo"}>
      <form onSubmit={aoEnviar} noValidate className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Placa"
            value={placa}
            onChange={(e) => {
              setPlaca(e.target.value.toUpperCase());
              limpar("placa");
            }}
            placeholder="ABC1D23"
            erro={erros.placa}
          />
          <Input
            label="Modelo"
            value={modelo}
            onChange={(e) => {
              setModelo(e.target.value);
              limpar("modelo");
            }}
            placeholder="Sprinter"
            erro={erros.modelo}
          />
        </div>
        <div className="grid grid-cols-3 gap-4">
          <Input
            label="Marca"
            value={marca}
            onChange={(e) => {
              setMarca(e.target.value);
              limpar("marca");
            }}
            placeholder="Mercedes"
            erro={erros.marca}
          />
          <Input
            label="Ano"
            type="number"
            value={ano}
            onChange={(e) => {
              setAno(e.target.value);
              limpar("ano");
            }}
            placeholder="2022"
            erro={erros.ano}
          />
          <Input
            label="Km atual"
            type="number"
            value={km}
            onChange={(e) => {
              setKm(e.target.value);
              limpar("km");
            }}
            placeholder="0"
            erro={erros.km}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Select
            label="Unidade"
            value={unidadeId}
            onChange={(e) => setUnidadeId(e.target.value)}
            opcoes={opcoesUnidade}
          />
          {edicao && (
            <Select
              label="Status"
              value={status}
              onChange={(e) => setStatus(e.target.value as StatusVeiculo)}
              opcoes={[
                { valor: "disponivel", rotulo: "Disponível" },
                { valor: "em_uso", rotulo: "Em uso" },
                { valor: "manutencao", rotulo: "Manutenção" },
              ]}
            />
          )}
        </div>

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
            {edicao ? "Salvar" : "Cadastrar"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
