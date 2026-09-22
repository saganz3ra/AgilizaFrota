"use client";

import { FormEvent, useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { Papel, Unidade, Usuario } from "@/types/api";
import {
  coletar,
  email as validarEmail,
  obrigatorio,
  tamanho,
  telefone as validarTelefone,
  useErrosCampo,
  type Erro,
} from "@/lib/validacao";
import { mascaraTelefone } from "@/lib/mascaras";
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

/** Senha não passa por trim (espaços podem ser intencionais). */
function validarSenha(senha: string): Erro {
  if (!senha) return "Senha é obrigatória.";
  if (senha.length < 6) return "Senha deve ter ao menos 6 caracteres.";
  if (senha.length > 128) return "Senha deve ter no máximo 128 caracteres.";
  return null;
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
  const { erros, setErros, limpar, limparTudo } = useErrosCampo();

  useEffect(() => {
    if (!aberto) return;
    setErro(null);
    limparTudo();
    setNome(usuario?.nome ?? "");
    setEmail(usuario?.email ?? "");
    setSenha("");
    setPapel(usuario?.papel ?? "motorista");
    setTelefone(usuario?.telefone ? mascaraTelefone(usuario.telefone) : "");
    setUnidadeId(usuario?.unidade_id ?? "");
  }, [aberto, usuario, limparTudo]);

  async function aoEnviar(e: FormEvent) {
    e.preventDefault();
    setErro(null);

    // Espelha usuarioValidators. E-mail/senha só existem na criação (no
    // backend eles vêm do token do Firebase na edição, não do formulário).
    const encontrados = coletar({
      nome: obrigatorio(nome, "Nome") ?? tamanho(nome, { min: 3, max: 100, nome: "Nome" }),
      telefone: validarTelefone(telefone),
      email: edicao ? null : validarEmail(email) ?? tamanho(email, { max: 150, nome: "E-mail" }),
      senha: edicao ? null : validarSenha(senha),
      // Regra do controller: recepcionista precisa de unidade.
      unidade_id:
        papel === "recepcionista" && !unidadeId ? "Recepcionista precisa de uma unidade." : null,
    });
    setErros(encontrados);
    if (Object.keys(encontrados).length > 0) return;

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
      <form onSubmit={aoEnviar} noValidate className="flex flex-col gap-4">
        <Input
          label="Nome"
          value={nome}
          onChange={(e) => {
            setNome(e.target.value);
            limpar("nome");
          }}
          erro={erros.nome}
        />

        {!edicao && (
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="E-mail"
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                limpar("email");
              }}
              placeholder="pessoa@hospital.gov.br"
              erro={erros.email}
            />
            <Input
              label="Senha"
              type="password"
              value={senha}
              onChange={(e) => {
                setSenha(e.target.value);
                limpar("senha");
              }}
              placeholder="mín. 6 caracteres"
              erro={erros.senha}
            />
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <Select
            label="Papel"
            value={papel}
            onChange={(e) => {
              setPapel(e.target.value as Papel);
              limpar("unidade_id");
            }}
            opcoes={[
              { valor: "motorista", rotulo: "Motorista" },
              { valor: "recepcionista", rotulo: "Recepcionista" },
              { valor: "central", rotulo: "Central" },
            ]}
          />
          <Input
            label="Telefone"
            value={telefone}
            inputMode="tel"
            onChange={(e) => {
              setTelefone(mascaraTelefone(e.target.value));
              limpar("telefone");
            }}
            placeholder="(42) 90000-0000"
            erro={erros.telefone}
          />
        </div>

        <Select
          label={papel === "recepcionista" ? "Unidade (obrigatória)" : "Unidade (opcional)"}
          value={unidadeId}
          onChange={(e) => {
            setUnidadeId(e.target.value);
            limpar("unidade_id");
          }}
          opcoes={opcoesUnidade}
          erro={erros.unidade_id}
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
