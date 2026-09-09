"use client";

import { useEffect, useState } from "react";
import { Building2, Plus, Pencil, Power, PowerOff } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { Unidade } from "@/types/api";
import { Card, CardBody } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { UnidadeModal } from "@/components/unidades/UnidadeModal";

export default function UnidadesPage() {
  const [unidades, setUnidades] = useState<Unidade[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [modalAberto, setModalAberto] = useState(false);
  const [emEdicao, setEmEdicao] = useState<Unidade | null>(null);

  useEffect(() => {
    let ativo = true;
    (async () => {
      try {
        const { unidades: lista } = await api<{ unidades: Unidade[] }>("/unidades");
        if (ativo) setUnidades(lista);
      } catch (e) {
        if (ativo) setErro(e instanceof ApiError ? e.message : "Falha ao carregar unidades.");
      } finally {
        if (ativo) setCarregando(false);
      }
    })();
    return () => {
      ativo = false;
    };
  }, []);

  function upsert(unidade: Unidade) {
    setUnidades((atual) => {
      const existe = atual.some((u) => u.id === unidade.id);
      return existe ? atual.map((u) => (u.id === unidade.id ? unidade : u)) : [unidade, ...atual];
    });
  }

  async function alternarAtivo(u: Unidade) {
    try {
      if (u.ativo) {
        const { unidade } = await api<{ unidade: Unidade }>(`/unidades/${u.id}`, { method: "DELETE" });
        upsert(unidade);
      } else {
        const { unidade } = await api<{ unidade: Unidade }>(`/unidades/${u.id}`, {
          method: "PUT",
          body: JSON.stringify({ ativo: true }),
        });
        upsert(unidade);
      }
    } catch {
      /* silencioso */
    }
  }

  function abrirNovo() {
    setEmEdicao(null);
    setModalAberto(true);
  }
  function abrirEdicao(u: Unidade) {
    setEmEdicao(u);
    setModalAberto(true);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-content">Unidades</h1>
          <p className="text-sm text-content-muted">Hospitais e pontos de apoio da operação.</p>
        </div>
        <Button onClick={abrirNovo}>
          <Plus size={18} />
          Nova unidade
        </Button>
      </div>

      {carregando ? (
        <div className="flex h-64 items-center justify-center">
          <Spinner />
        </div>
      ) : erro ? (
        <Card>
          <CardBody>
            <p className="text-sm text-content-muted">{erro}</p>
          </CardBody>
        </Card>
      ) : unidades.length === 0 ? (
        <Card>
          <CardBody>
            <div className="flex flex-col items-center gap-2 py-8 text-center text-content-muted">
              <Building2 />
              <p className="text-sm">Nenhuma unidade cadastrada.</p>
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
                    <th className="px-5 py-3 font-medium">Cidade</th>
                    <th className="px-5 py-3 font-medium">Endereço</th>
                    <th className="px-5 py-3 font-medium">Situação</th>
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {unidades.map((u) => (
                    <tr key={u.id} className={["border-b border-surface-border last:border-0", u.ativo ? "" : "opacity-50"].join(" ")}>
                      <td className="px-5 py-3 font-semibold text-content">{u.nome}</td>
                      <td className="px-5 py-3 text-content-muted">{u.cidade}</td>
                      <td className="px-5 py-3 text-content-muted">{u.endereco}</td>
                      <td className="px-5 py-3">
                        <Badge tom={u.ativo ? "disponivel" : "neutro"}>{u.ativo ? "Ativa" : "Inativa"}</Badge>
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

      <UnidadeModal
        aberto={modalAberto}
        aoFechar={() => setModalAberto(false)}
        aoSalvar={upsert}
        unidade={emEdicao}
      />
    </div>
  );
}
