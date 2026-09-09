"use client";

import { useEffect, useMemo, useState } from "react";
import { ClipboardList, Eye } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { ItemChecklist, Turno, Usuario, Veiculo } from "@/types/api";
import { Card, CardBody } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { TurnoDetalheModal } from "@/components/turnos/TurnoDetalheModal";

type Filtro = "todos" | "aberto" | "encerrado";

export default function TurnosPage() {
  const [turnos, setTurnos] = useState<Turno[]>([]);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [veiculos, setVeiculos] = useState<Veiculo[]>([]);
  const [itens, setItens] = useState<ItemChecklist[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [detalheId, setDetalheId] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    (async () => {
      try {
        const [t, u, v, i] = await Promise.all([
          api<{ turnos: Turno[] }>("/turnos"),
          api<{ usuarios: Usuario[] }>("/usuarios"),
          api<{ veiculos: Veiculo[] }>("/veiculos"),
          api<{ itens: ItemChecklist[] }>("/turnos/checklist/itens"),
        ]);
        if (!ativo) return;
        setTurnos(t.turnos);
        setUsuarios(u.usuarios);
        setVeiculos(v.veiculos);
        setItens(i.itens);
      } catch (e) {
        if (ativo) setErro(e instanceof ApiError ? e.message : "Falha ao carregar turnos.");
      } finally {
        if (ativo) setCarregando(false);
      }
    })();
    return () => {
      ativo = false;
    };
  }, []);

  const nomeMotorista = (id: string) => usuarios.find((u) => u.id === id)?.nome ?? "—";
  const placaVeiculo = (id: string) => veiculos.find((v) => v.id === id)?.placa ?? "—";

  const visiveis = useMemo(
    () => (filtro === "todos" ? turnos : turnos.filter((t) => t.status === filtro)),
    [turnos, filtro],
  );

  const detalhe = turnos.find((t) => t.id === detalheId) || null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-content">Turnos</h1>
        <p className="text-sm text-content-muted">Acompanhamento dos turnos dos motoristas.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {(["todos", "aberto", "encerrado"] as Filtro[]).map((f) => (
          <button
            key={f}
            onClick={() => setFiltro(f)}
            className={[
              "rounded-full px-3 py-1.5 text-sm font-medium capitalize transition-colors",
              filtro === f ? "bg-brand text-brand-contrast" : "bg-surface text-content-muted hover:bg-surface-muted",
            ].join(" ")}
          >
            {f === "aberto" ? "Abertos" : f === "encerrado" ? "Encerrados" : "Todos"}
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
              <ClipboardList />
              <p className="text-sm">Nenhum turno nesta visão.</p>
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
                    <th className="px-5 py-3 font-medium">Motorista</th>
                    <th className="px-5 py-3 font-medium">Veículo</th>
                    <th className="px-5 py-3 font-medium">Km (início → fim)</th>
                    <th className="px-5 py-3 font-medium">Início</th>
                    <th className="px-5 py-3 font-medium">Status</th>
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {visiveis.map((t) => (
                    <tr key={t.id} className="border-b border-surface-border last:border-0">
                      <td className="px-5 py-3 font-medium text-content">{nomeMotorista(t.motorista_id)}</td>
                      <td className="px-5 py-3 text-content-muted">{placaVeiculo(t.veiculo_id)}</td>
                      <td className="px-5 py-3 text-content-muted">
                        {t.km_inicial.toLocaleString("pt-BR")} → {t.km_final !== null ? t.km_final.toLocaleString("pt-BR") : "—"}
                      </td>
                      <td className="px-5 py-3 text-content-muted">
                        {new Date(t.inicio_em).toLocaleString("pt-BR")}
                      </td>
                      <td className="px-5 py-3">
                        <Badge tom={t.status === "aberto" ? "uso" : "neutro"}>
                          {t.status === "aberto" ? "Aberto" : "Encerrado"}
                        </Badge>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex justify-end">
                          <Button variante="ghost" tamanho="sm" onClick={() => setDetalheId(t.id)}>
                            <Eye size={16} />
                            Detalhes
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

      <TurnoDetalheModal
        turnoId={detalheId}
        aoFechar={() => setDetalheId(null)}
        itensCatalogo={itens}
        nomeMotorista={detalhe ? nomeMotorista(detalhe.motorista_id) : "—"}
        placaVeiculo={detalhe ? placaVeiculo(detalhe.veiculo_id) : "—"}
      />
    </div>
  );
}
