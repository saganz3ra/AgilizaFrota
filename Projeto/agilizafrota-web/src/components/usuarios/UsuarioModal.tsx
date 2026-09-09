"use client";

import { FormEvent, useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { Papel, Unidade, Usuario } from "@/types/api";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";

interface Props {
  aberto: boolean;
  aoFechar: () => void;
  aoSalvar: (usuario: Usuario) => void;
  unidades: Unidade[];
  usuario?: Usuario | null; // presente = edição
}

/** Formulário de criação/edição de usuário (RF02) — operações da central. */
export function UsuarioModal({ aberto, aoFechar, aoSalvar, unidades, usuario }: Props) {
  const edicao = Boolean(usuario);
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [papel, setPapel] = useState<Papel>("motorista");
  const [telefone, setTelefone] = useState("");
  const [unidadeId, setUnidadeId] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (!aberto) return;
    setErro(null);
    setNome(usuario?.nome ?? "");
    setEmail(usuario?.email ?? "");
    setSenha("");
    setPapel(usuario?.papel ?? "motorista");
    setTelefone(usuario?.telefone ?? "");
    setUnidadeId(usuario?.unidade_id ?? "");
  }, [aberto, usuario]);

  async function aoEnviar(e: FormEvent) {
    e.preventDefault();
    setErro(null);

    if (papel === "recepcionista" && !unidadeId) {
      setErro("Recepcionista precisa de uma unidade.");
      return;
    }

    setEnviando(true);
    try {
      let resposta: { usuario: Usuario };
      if (edicao) {
        const corpo: Record<string, unknown> = {
          nome: nome.trim(),
          papel,
          telefone: telefone.trim() || null,
          unidade_id: unidadeId || null,
        };
        resposta = await api<{ usuario: Usuario }>(`/usuarios/${usuario!.id}`, {
          method: "PUT",
          body: JSON.stringify(corpo),
        });
      } else {
        const corpo: Record<string, unknown> = {
          nome: nome.trim(),
          email: email.trim().toLowerCase(),
          senha,
          papel,
        };
        if (telefone.trim()) corpo.telefone = telefone.trim();
        if (unidadeId) corpo.unidade_id = unidadeId;
        resposta = await api<{ usuario: Usuario }>("/usuarios", {
          method: "POST",
          body: JSON.stringify(corpo),
        });
      }
      aoSalvar(resposta.usuario);
      aoFechar();
    } catch (err) {
      setErro(err instanceof ApiError ? err.message : "Não foi possível salvar o usuário.");
    } finally {
      setEnviando(false);
    }
  }

  const opcoesUnidade = [
    { valor: "", rotulo: papel === "recepcionista" ? "— Selecione —" : "— Sem unidade —" },
    ...unidades.map((u) => ({ valor: u.id, rotulo: u.nome })),
  ];

  return (
    <Modal aberto={aberto} aoFechar={aoFechar} titulo={edicao ? "Editar usuário" : "Novo usuário"}>
      <form onSubmit={aoEnviar} className="flex flex-col gap-4">
        <Input label="Nome" value={nome} onChange={(e) => setNome(e.target.value)} required minLength={3} />

        {!edicao && (
          <div className="grid grid-cols-2 gap-4">
            <Input label="E-mail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="pessoa@hospital.gov.br" />
            <Input label="Senha" type="password" value={senha} onChange={(e) => setSenha(e.target.value)} required minLength={6} placeholder="mín. 6 caracteres" />
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <Select
            label="Papel"
            value={papel}
            onChange={(e) => setPapel(e.target.value as Papel)}
            opcoes={[
              { valor: "motorista", rotulo: "Motorista" },
              { valor: "recepcionista", rotulo: "Recepcionista" },
              { valor: "central", rotulo: "Central" },
            ]}
          />
          <Input label="Telefone" value={telefone} onChange={(e) => setTelefone(e.target.value)} placeholder="(42) 90000-0000" />
        </div>

        <Select
          label={papel === "recepcionista" ? "Unidade (obrigatória)" : "Unidade (opcional)"}
          value={unidadeId}
          onChange={(e) => setUnidadeId(e.target.value)}
          opcoes={opcoesUnidade}
        />

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
