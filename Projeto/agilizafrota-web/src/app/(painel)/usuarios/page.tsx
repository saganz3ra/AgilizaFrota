"use client";

import { useEffect, useMemo, useState } from "react";
import { Users, Plus, Pencil, Power, PowerOff } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { Papel, Unidade, Usuario } from "@/types/api";
import { Card, CardBody } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { UsuarioModal } from "@/components/usuarios/UsuarioModal";

const ROTULO_PAPEL: Record<Papel, string> = {
  motorista: "Motorista",
  recepcionista: "Recepcionista",
  central: "Central",
};

type FiltroPapel = "todos" | Papel;

export default function UsuariosPage() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [unidades, setUnidades] = useState<Unidade[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<FiltroPapel>("todos");
  const [modalAberto, setModalAberto] = useState(false);
  const [emEdicao, setEmEdicao] = useState<Usuario | null>(null);

  useEffect(() => {
    let ativo = true;
    (async () => {
      try {
        const [u, un] = await Promise.all([
          api<{ usuarios: Usuario[] }>("/usuarios"),
          api<{ unidades: Unidade[] }>("/unidades"),
        ]);
        if (!ativo) return;
        setUsuarios(u.usuarios);
        setUnidades(un.unidades);
      } catch (e) {
        if (ativo) setErro(e instanceof ApiError ? e.message : "Falha ao carregar usuários.");
      } finally {
        if (ativo) setCarregando(false);
      }
    })();
    return () => {
      ativo = false;
    };
  }, []);

  function upsert(usuario: Usuario) {
    setUsuarios((atual) => {
      const existe = atual.some((u) => u.id === usuario.id);
      return existe ? atual.map((u) => (u.id === usuario.id ? usuario : u)) : [usuario, ...atual];
    });
  }

  async function alternarAtivo(u: Usuario) {
    try {
      const acao = u.ativo ? "desativar" : "ativar";
      const { usuario } = await api<{ usuario: Usuario }>(`/usuarios/${u.id}/${acao}`, {
        method: "PATCH",
      });
      upsert(usuario);
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : "Não foi possível alterar o usuário.");
    }
  }

  function abrirNovo() {
    setEmEdicao(null);
    setModalAberto(true);
  }
  function abrirEdicao(u: Usuario) {
    setEmEdicao(u);
    setModalAberto(true);
  }

  const visiveis = useMemo(
    () => (filtro === "todos" ? usuarios : usuarios.filter((u) => u.papel === filtro)),
    [usuarios, filtro],
  );

  const nomeUnidade = (id: string | null) => (id ? unidades.find((u) => u.id === id)?.nome ?? "—" : "—");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-content">Usuários</h1>
          <p className="text-sm text-content-muted">Motoristas, recepcionistas e operadores da central.</p>
        </div>
        <Button onClick={abrirNovo}>
          <Plus size={18} />
          Novo usuário
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {(["todos", "motorista", "recepcionista", "central"] as FiltroPapel[]).map((f) => (
          <button
            key={f}
            onClick={() => setFiltro(f)}
            className={[
              "rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
              filtro === f ? "bg-brand text-brand-contrast" : "bg-surface text-content-muted hover:bg-surface-muted",
            ].join(" ")}
          >
            {f === "todos" ? "Todos" : ROTULO_PAPEL[f]}
          </button>
        ))}
      </div>

      {erro && (
        <Card>
          <CardBody>
            <p className="text-sm text-prioridade-critica">{erro}</p>
          </CardBody>
        </Card>
      )}

      {carregando ? (
        <div className="flex h-64 items-center justify-center">
          <Spinner />
        </div>
      ) : visiveis.length === 0 ? (
        <Card>
          <CardBody>
            <div className="flex flex-col items-center gap-2 py-8 text-center text-content-muted">
              <Users />
              <p className="text-sm">Nenhum usuário nesta visão.</p>
            </div>
          </CardBody>
        </Card>
      ) : (
        <Card>
          <CardBody className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-surface-border text-left text-content-muted">
                    <th className="px-5 py-3 font-medium">Nome</th>
                    <th className="px-5 py-3 font-medium">E-mail</th>
                    <th className="px-5 py-3 font-medium">Papel</th>
                    <th className="px-5 py-3 font-medium">Unidade</th>
                    <th className="px-5 py-3 font-medium">Situação</th>
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {visiveis.map((u) => (
                    <tr key={u.id} className={["border-b border-surface-border last:border-0", u.ativo ? "" : "opacity-50"].join(" ")}>
                      <td className="px-5 py-3 font-semibold text-content">{u.nome}</td>
                      <td className="px-5 py-3 text-content-muted">{u.email}</td>
                      <td className="px-5 py-3">
                        <Badge tom={u.papel === "central" ? "uso" : "neutro"}>{ROTULO_PAPEL[u.papel]}</Badge>
                      </td>
                      <td className="px-5 py-3 text-content-muted">{nomeUnidade(u.unidade_id)}</td>
                      <td className="px-5 py-3">
                        <Badge tom={u.ativo ? "disponivel" : "neutro"}>{u.ativo ? "Ativo" : "Inativo"}</Badge>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex justify-end gap-1">
                          <Button variante="ghost" tamanho="sm" onClick={() => abrirEdicao(u)}>
                            <Pencil size={16} />
                            Editar
                          </Button>
                          <Button variante="ghost" tamanho="sm" onClick={() => alternarAtivo(u)}>
                            {u.ativo ? <PowerOff size={16} /> : <Power size={16} />}
                            {u.ativo ? "Desativar" : "Ativar"}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardBody>
        </Card>
      )}

      <UsuarioModal
        aberto={modalAberto}
        aoFechar={() => setModalAberto(false)}
        aoSalvar={upsert}
        unidades={unidades}
        usuario={emEdicao}
      />
    </div>
  );
}
