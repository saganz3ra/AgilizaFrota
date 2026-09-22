"use client";

import { FormEvent, useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { Unidade } from "@/types/api";
import {
  coletar,
  decimalOpcional,
  obrigatorio,
  tamanho,
  useErrosCampo,
} from "@/lib/validacao";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

interface Props {
  aberto: boolean;
  aoFechar: () => void;
  aoSalvar: (unidade: Unidade) => void;
  unidade?: Unidade | null; // presente = edição
}

/** Formulário de criação/edição de unidade hospitalar (RF02). */
export function UnidadeModal({ aberto, aoFechar, aoSalvar, unidade }: Props) {
  const edicao = Boolean(unidade);
  const [nome, setNome] = useState("");
  const [endereco, setEndereco] = useState("");
  const [cidade, setCidade] = useState("");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const { erros, setErros, limpar, limparTudo } = useErrosCampo();

  useEffect(() => {
    if (!aberto) return;
    setErro(null);
    limparTudo();
    setNome(unidade?.nome ?? "");
    setEndereco(unidade?.endereco ?? "");
    setCidade(unidade?.cidade ?? "");
    setLat(unidade?.lat ?? "");
    setLng(unidade?.lng ?? "");
  }, [aberto, unidade, limparTudo]);

  async function aoEnviar(e: FormEvent) {
    e.preventDefault();
    setErro(null);

    // Espelha unidadeValidators. Uso as faixas geográficas corretas
    // (lat -90..90, lng -180..180) — mais estritas que o backend, mas só
    // recusam coordenada realmente inválida.
    const encontrados = coletar({
      nome: obrigatorio(nome, "Nome") ?? tamanho(nome, { min: 3, max: 100, nome: "Nome" }),
      endereco: obrigatorio(endereco, "Endereço") ?? tamanho(endereco, { min: 3, nome: "Endereço" }),
      cidade: tamanho(cidade, { max: 50, nome: "Cidade" }),
      lat: decimalOpcional(lat, { min: -90, max: 90, nome: "Latitude" }),
      lng: decimalOpcional(lng, { min: -180, max: 180, nome: "Longitude" }),
    });
    setErros(encontrados);
    if (Object.keys(encontrados).length > 0) return;

    setEnviando(true);
    try {
      const corpo: Record<string, unknown> = {
        nome: nome.trim(),
        endereco: endereco.trim(),
      };
      if (cidade.trim()) corpo.cidade = cidade.trim();
      if (lat !== "") corpo.lat = Number(lat);
      if (lng !== "") corpo.lng = Number(lng);

      const resposta = edicao
        ? await api<{ unidade: Unidade }>(`/unidades/${unidade!.id}`, {
            method: "PUT",
            body: JSON.stringify(corpo),
          })
        : await api<{ unidade: Unidade }>("/unidades", {
            method: "POST",
            body: JSON.stringify(corpo),
          });
      aoSalvar(resposta.unidade);
      aoFechar();
    } catch (err) {
      setErro(err instanceof ApiError ? err.message : "Não foi possível salvar a unidade.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Modal aberto={aberto} aoFechar={aoFechar} titulo={edicao ? "Editar unidade" : "Nova unidade"}>
      <form onSubmit={aoEnviar} noValidate className="flex flex-col gap-4">
        <Input
          label="Nome"
          value={nome}
          onChange={(e) => {
            setNome(e.target.value);
            limpar("nome");
          }}
          placeholder="Hospital Municipal"
          erro={erros.nome}
        />
        <Input
          label="Endereço"
          value={endereco}
          onChange={(e) => {
            setEndereco(e.target.value);
            limpar("endereco");
          }}
          placeholder="Rua, número, bairro"
          erro={erros.endereco}
        />
        <div className="grid grid-cols-3 gap-4">
          <Input
            label="Cidade"
            value={cidade}
            onChange={(e) => {
              setCidade(e.target.value);
              limpar("cidade");
            }}
            placeholder="Guarapuava"
            erro={erros.cidade}
          />
          <Input
            label="Latitude"
            value={lat}
            onChange={(e) => {
              setLat(e.target.value);
              limpar("lat");
            }}
            placeholder="-25.39"
            inputMode="decimal"
            erro={erros.lat}
          />
          <Input
            label="Longitude"
            value={lng}
            onChange={(e) => {
              setLng(e.target.value);
              limpar("lng");
            }}
            placeholder="-51.45"
            inputMode="decimal"
            erro={erros.lng}
          />
        </div>

        {erro && (
          <p className="rounded-lg bg-prioridade-critica/10 px-3 py-2 text-sm text-prioridade-critica">{erro}</p>
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
