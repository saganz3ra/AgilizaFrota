"use client";

import { useEffect, useState } from "react";
import { Truck, PhoneCall, ClipboardList, TriangleAlert } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Spinner } from "@/components/ui/Spinner";
import { Chamado, Turno, Veiculo } from "@/types/api";

interface Resumo {
  veiculos: Veiculo[];
  chamadosAbertos: Chamado[];
  turnosAbertos: Turno[];
}

const tomPrioridade = {
  critica: "critica",
  alta: "alta",
  media: "media",
  baixa: "baixa",
} as const;

export default function DashboardPage() {
  const [dados, setDados] = useState<Resumo | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let ativo = true;
    (async () => {
      try {
        const [veic, cham, turn] = await Promise.all([
          api<{ veiculos: Veiculo[] }>("/veiculos"),
          api<{ chamados: Chamado[] }>("/chamados?status=aberto"),
          api<{ turnos: Turno[] }>("/turnos?status=aberto"),
        ]);
        if (!ativo) return;
        setDados({
          veiculos: veic.veiculos,
          chamadosAbertos: cham.chamados,
          turnosAbertos: turn.turnos,
        });
      } catch (e) {
        if (!ativo) return;
        setErro(e instanceof ApiError ? e.message : "Falha ao carregar os dados.");
      } finally {
        if (ativo) setCarregando(false);
      }
    })();
    return () => {
      ativo = false;
    };
  }, []);

  if (carregando) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (erro) {
    return (
      <Card>
        <CardBody>
          <div className="flex items-center gap-3 text-content-muted">
            <TriangleAlert className="text-prioridade-alta" />
            <div>
              <p className="font-medium text-content">Não foi possível carregar o painel</p>
              <p className="text-sm">{erro}</p>
            </div>
          </div>
        </CardBody>
      </Card>
    );
  }

  const veiculos = dados?.veiculos ?? [];
  const disponiveis = veiculos.filter((v) => v.status === "disponivel").length;
  const emUso = veiculos.filter((v) => v.status === "em_uso").length;
  const manutencao = veiculos.filter((v) => v.status === "manutencao").length;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-content">Painel</h1>
        <p className="text-sm text-content-muted">Visão geral da operação em tempo real.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icone={<PhoneCall />} rotulo="Chamados abertos" valor={dados?.chamadosAbertos.length ?? 0} destaque />
        <StatCard icone={<Truck />} rotulo="Veículos disponíveis" valor={disponiveis} />
        <StatCard icone={<ClipboardList />} rotulo="Turnos ativos" valor={dados?.turnosAbertos.length ?? 0} />
        <StatCard icone={<Truck />} rotulo="Frota (uso / manutenção)" valor={`${emUso} / ${manutencao}`} />
      </div>

      <Card>
        <CardHeader>
          <h2 className="font-semibold text-content">Chamados abertos</h2>
        </CardHeader>
        <CardBody className="p-0">
          {(dados?.chamadosAbertos.length ?? 0) === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-content-muted">
              Nenhum chamado aberto no momento.
            </p>
          ) : (
            <ul className="divide-y divide-surface-border">
              {dados?.chamadosAbertos.map((c) => (
                <li key={c.id} className="flex items-center justify-between px-5 py-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-content">{c.natureza}</p>
                    <p className="text-xs capitalize text-content-muted">{c.tipo}</p>
                  </div>
                  <Badge tom={tomPrioridade[c.prioridade]}>{c.prioridade}</Badge>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

function StatCard({
  icone,
  rotulo,
  valor,
  destaque,
}: {
  icone: React.ReactNode;
  rotulo: string;
  valor: number | string;
  destaque?: boolean;
}) {
  return (
    <Card className={destaque ? "border-brand/30" : ""}>
      <CardBody className="flex items-center gap-4">
        <span
          className={[
            "flex h-11 w-11 items-center justify-center rounded-lg",
            destaque ? "bg-brand text-brand-contrast" : "bg-brand-light text-brand",
          ].join(" ")}
        >
          {icone}
        </span>
        <div>
          <p className="text-2xl font-bold text-content">{valor}</p>
          <p className="text-xs text-content-muted">{rotulo}</p>
        </div>
      </CardBody>
    </Card>
  );
}
