"use client";

import { useEffect, useMemo, useState } from "react";
import { Truck, Plus, Pencil, Power } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { Unidade, Veiculo, StatusVeiculo } from "@/types/api";
import { Card, CardBody } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { VeiculoModal } from "@/components/veiculos/VeiculoModal";

const TOM_STATUS: Record<StatusVeiculo, "disponivel" | "uso" | "manutencao"> = {
  disponivel: "disponivel",
  em_uso: "uso",
  manutencao: "manutencao",
};
const ROTULO_STATUS: Record<StatusVeiculo, string> = {
  disponivel: "Disponível",
  em_uso: "Em uso",
  manutencao: "Manutenção",
};

type FiltroStatus = "todos" | StatusVeiculo;

export default function VeiculosPage() {
  const [veiculos, setVeiculos] = useState<Veiculo[]>([]);
  const [unidades, setUnidades] = useState<Unidade[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<FiltroStatus>("todos");
  const [modalAberto, setModalAberto] = useState(false);
  const [emEdicao, setEmEdicao] = useState<Veiculo | null>(null);

  useEffect(() => {
    let ativo = true;
    (async () => {
      try {
        const [v, u] = await Promise.all([
          api<{ veiculos: Veiculo[] }>("/veiculos"),
          api<{ unidades: Unidade[] }>("/unidades"),
        ]);
        if (!ativo) return;
        setVeiculos(v.veiculos);
        setUnidades(u.unidades);
      } catch (e) {
        if (ativo) setErro(e instanceof ApiError ? e.message : "Falha ao carregar veículos.");
      } finally {
        if (ativo) setCarregando(false);
      }
    })();
    return () => {
      ativo = false;
    };
  }, []);

  function upsert(veiculo: Veiculo) {
    setVeiculos((atual) => {
      const existe = atual.some((v) => v.id === veiculo.id);
      return existe ? atual.map((v) => (v.id === veiculo.id ? veiculo : v)) : [veiculo, ...atual];
    });
  }

  async function desativar(id: string) {
    try {
      const { veiculo } = await api<{ veiculo: Veiculo }>(`/veiculos/${id}`, { method: "DELETE" });
      upsert(veiculo);
    } catch {
      /* silencioso */
    }
  }

  function abrirNovo() {
    setEmEdicao(null);
    setModalAberto(true);
  }
  function abrirEdicao(v: Veiculo) {
    setEmEdicao(v);
    setModalAberto(true);
  }

  const visiveis = useMemo(
    () => (filtro === "todos" ? veiculos : veiculos.filter((v) => v.status === filtro)),
    [veiculos, filtro],
  );

  const nomeUnidade = (id: string | null) =>
    id ? unidades.find((u) => u.id === id)?.nome ?? "—" : "—";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-content">Veículos</h1>
          <p className="text-sm text-content-muted">Cadastro e situação da frota.</p>
        </div>
        <Button onClick={abrirNovo}>
          <Plus size={18} />
          Novo veículo
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {(["todos", "disponivel", "em_uso", "manutencao"] as FiltroStatus[]).map((f) => (
          <button
            key={f}
            onClick={() => setFiltro(f)}
            className={[
              "rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
              filtro === f ? "bg-brand text-brand-contrast" : "bg-surface text-content-muted hover:bg-surface-muted",
            ].join(" ")}
          >
            {f === "todos" ? "Todos" : ROTULO_STATUS[f]}
          </button>
        ))}
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
      ) : visiveis.length === 0 ? (
        <Card>
          <CardBody>
            <div className="flex flex-col items-center gap-2 py-8 text-center text-content-muted">
              <Truck />
              <p className="text-sm">Nenhum veículo nesta visão.</p>
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
                    <th className="px-5 py-3 font-medium">Placa</th>
                    <th className="px-5 py-3 font-medium">Modelo</th>
                    <th className="px-5 py-3 font-medium">Unidade</th>
                    <th className="px-5 py-3 font-medium">Km</th>
                    <th className="px-5 py-3 font-medium">Status</th>
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {visiveis.map((v) => (
                    <tr
                      key={v.id}
                      className={[
                        "border-b border-surface-border last:border-0",
                        v.ativo ? "" : "opacity-50",
                      ].join(" ")}
                    >
                      <td className="px-5 py-3 font-semibold text-content">{v.placa}</td>
                      <td className="px-5 py-3 text-content">
                        {v.modelo}
                        {v.marca ? <span className="text-content-muted"> · {v.marca}</span> : null}
                      </td>
                      <td className="px-5 py-3 text-content-muted">{nomeUnidade(v.unidade_id)}</td>
                      <td className="px-5 py-3 text-content-muted">{v.quilometragem_atual.toLocaleString("pt-BR")}</td>
                      <td className="px-5 py-3">
                        <Badge tom={TOM_STATUS[v.status]}>{ROTULO_STATUS[v.status]}</Badge>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex justify-end gap-1">
                          <Button variante="ghost" tamanho="sm" onClick={() => abrirEdicao(v)}>
                            <Pencil size={16} />
                            Editar
                          </Button>
                          {v.ativo && (
                            <Button variante="ghost" tamanho="sm" onClick={() => desativar(v.id)}>
                              <Power size={16} />
                              Desativar
                            </Button>
                          )}
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

      <VeiculoModal
        aberto={modalAberto}
        aoFechar={() => setModalAberto(false)}
        aoSalvar={upsert}
        unidades={unidades}
        veiculo={emEdicao}
      />
    </div>
  );
}
