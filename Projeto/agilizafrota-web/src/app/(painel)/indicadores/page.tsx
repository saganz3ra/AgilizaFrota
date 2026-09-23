"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Legend,
} from "recharts";
import { PhoneCall, Truck, Stethoscope, Gauge } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import {
  Chamado,
  Veiculo,
  RelatorioResposta,
  PrioridadeChamado,
  StatusChamado,
  StatusVeiculo,
} from "@/types/api";
import { Spinner } from "@/components/ui/Spinner";
import { Card, CardBody } from "@/components/ui/Card";
import {
  CartaoGrafico,
  EstadoVazioGrafico,
  TooltipGrafico,
} from "@/components/graficos/Comuns";
import { usePaletaGrafico } from "@/lib/graficos";

const ROTULO_PRIORIDADE: Record<PrioridadeChamado, string> = {
  critica: "Crítica",
  alta: "Alta",
  media: "Média",
  baixa: "Baixa",
};
const ORDEM_PRIORIDADE: PrioridadeChamado[] = ["critica", "alta", "media", "baixa"];

const ROTULO_STATUS_CHAMADO: Record<StatusChamado, string> = {
  aberto: "Aberto",
  atribuido: "Atribuído",
  em_atendimento: "Em atendimento",
  concluido: "Concluído",
  cancelado: "Cancelado",
};
const ORDEM_STATUS: StatusChamado[] = [
  "aberto",
  "atribuido",
  "em_atendimento",
  "concluido",
  "cancelado",
];

const ROTULO_STATUS_VEICULO: Record<StatusVeiculo, string> = {
  disponivel: "Disponível",
  em_uso: "Em uso",
  manutencao: "Manutenção",
};

export default function IndicadoresPage() {
  const paleta = usePaletaGrafico();
  const [chamados, setChamados] = useState<Chamado[]>([]);
  const [veiculos, setVeiculos] = useState<Veiculo[]>([]);
  const [desempenho, setDesempenho] = useState<RelatorioResposta | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    (async () => {
      try {
        const [c, v, d] = await Promise.all([
          api<{ chamados: Chamado[] }>("/chamados"),
          api<{ veiculos: Veiculo[] }>("/veiculos"),
          api<RelatorioResposta>("/relatorios/desempenho?formato=json"),
        ]);
        if (!ativo) return;
        setChamados(c.chamados);
        setVeiculos(v.veiculos);
        setDesempenho(d);
      } catch (e) {
        if (ativo) {
          setErro(e instanceof ApiError ? e.message : "Falha ao carregar os indicadores.");
        }
      } finally {
        if (ativo) setCarregando(false);
      }
    })();
    return () => {
      ativo = false;
    };
  }, []);

  const porPrioridade = useMemo(
    () =>
      ORDEM_PRIORIDADE.map((p) => ({
        nome: ROTULO_PRIORIDADE[p],
        valor: chamados.filter((c) => c.prioridade === p).length,
        cor: paleta.prioridade[p],
      })),
    [chamados, paleta],
  );

  const porStatus = useMemo(
    () =>
      ORDEM_STATUS.map((s) => ({
        nome: ROTULO_STATUS_CHAMADO[s],
        valor: chamados.filter((c) => c.status === s).length,
      })),
    [chamados],
  );

  const porSituacaoVeiculo = useMemo(() => {
    const ativos = veiculos.filter((v) => v.ativo);
    return (["disponivel", "em_uso", "manutencao"] as StatusVeiculo[])
      .map((s) => ({
        nome: ROTULO_STATUS_VEICULO[s],
        valor: ativos.filter((v) => v.status === s).length,
        cor: paleta.statusVeiculo[
          s === "em_uso" ? "uso" : (s as "disponivel" | "manutencao")
        ],
      }))
      .filter((d) => d.valor > 0);
  }, [veiculos, paleta]);

  const porMotorista = useMemo(() => {
    const linhas = desempenho?.linhas ?? [];
    return linhas
      .map((l) => ({
        nome: String(l.motorista ?? "—"),
        valor: Number(l.atendimentos ?? 0),
      }))
      .filter((d) => d.valor > 0)
      .sort((a, b) => b.valor - a.valor)
      .slice(0, 8);
  }, [desempenho]);

  const totalAtendimentos = porMotorista.reduce((s, d) => s + d.valor, 0);
  const kmTotal = Number(desempenho?.resumo?.km_total ?? 0);
  const disponiveis = veiculos.filter((v) => v.ativo && v.status === "disponivel").length;
  const chamadosAtivos = chamados.filter((c) =>
    ["aberto", "atribuido", "em_atendimento"].includes(c.status),
  ).length;

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
          <p className="text-sm text-content-muted">{erro}</p>
        </CardBody>
      </Card>
    );
  }

  const eixoComum = {
    stroke: paleta.textoSuave,
    fontSize: 12,
    tickLine: false,
  } as const;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-content">Indicadores</h1>
        <p className="text-sm text-content-muted">
          Distribuições atuais da operação. Para tabelas e exportação, use{" "}
          <span className="font-medium">Relatórios</span>.
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi icone={<PhoneCall size={20} />} rotulo="Chamados ativos" valor={chamadosAtivos} cor="var(--acento-chamados)" />
        <Kpi icone={<Truck size={20} />} rotulo="Veículos disponíveis" valor={disponiveis} cor="var(--acento-veiculos)" />
        <Kpi icone={<Stethoscope size={20} />} rotulo="Atendimentos (concluídos)" valor={totalAtendimentos} cor="var(--acento-turnos)" />
        <Kpi icone={<Gauge size={20} />} rotulo="Km percorridos" valor={kmTotal.toLocaleString("pt-BR")} cor="var(--acento-frota)" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Chamados por prioridade — barras (cor semântica + rótulo) */}
        <CartaoGrafico titulo="Chamados por prioridade">
          {porPrioridade.every((d) => d.valor === 0) ? (
            <EstadoVazioGrafico texto="Nenhum chamado registrado." />
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart layout="vertical" data={porPrioridade} margin={{ left: 8, right: 24 }}>
                <CartesianGrid horizontal={false} stroke={paleta.grade} />
                <XAxis type="number" allowDecimals={false} {...eixoComum} />
                <YAxis type="category" dataKey="nome" width={72} {...eixoComum} />
                <Tooltip cursor={{ fill: paleta.grade, opacity: 0.4 }} content={<TooltipGrafico />} />
                <Bar dataKey="valor" name="Chamados" radius={[0, 4, 4, 0]} label={{ position: "right", fill: paleta.textoSuave, fontSize: 12 }}>
                  {porPrioridade.map((d) => (
                    <Cell key={d.nome} fill={d.cor} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </CartaoGrafico>

        {/* Chamados por status — barras (uma cor, magnitude) */}
        <CartaoGrafico titulo="Chamados por status">
          {porStatus.every((d) => d.valor === 0) ? (
            <EstadoVazioGrafico texto="Nenhum chamado registrado." />
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart layout="vertical" data={porStatus} margin={{ left: 8, right: 24 }}>
                <CartesianGrid horizontal={false} stroke={paleta.grade} />
                <XAxis type="number" allowDecimals={false} {...eixoComum} />
                <YAxis type="category" dataKey="nome" width={110} {...eixoComum} />
                <Tooltip cursor={{ fill: paleta.grade, opacity: 0.4 }} content={<TooltipGrafico />} />
                <Bar dataKey="valor" name="Chamados" fill={paleta.serie.chamados} radius={[0, 4, 4, 0]} label={{ position: "right", fill: paleta.textoSuave, fontSize: 12 }} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CartaoGrafico>

        {/* Frota por situação — donut */}
        <CartaoGrafico titulo="Frota por situação">
          {porSituacaoVeiculo.length === 0 ? (
            <EstadoVazioGrafico texto="Nenhum veículo ativo." />
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie
                  data={porSituacaoVeiculo}
                  dataKey="valor"
                  nameKey="nome"
                  innerRadius={55}
                  outerRadius={85}
                  paddingAngle={2}
                  stroke={paleta.superficie}
                  strokeWidth={2}
                  label={(p) => `${p.name}: ${p.value}`}
                  labelLine={false}
                >
                  {porSituacaoVeiculo.map((d) => (
                    <Cell key={d.nome} fill={d.cor} />
                  ))}
                </Pie>
                <Tooltip content={<TooltipGrafico />} />
                <Legend
                  verticalAlign="bottom"
                  iconType="circle"
                  formatter={(v) => <span className="text-xs text-content-muted">{v}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </CartaoGrafico>

        {/* Atendimentos por motorista — barras */}
        <CartaoGrafico titulo="Atendimentos por motorista" subtitulo="Concluídos, do período disponível">
          {porMotorista.length === 0 ? (
            <EstadoVazioGrafico texto="Sem atendimentos concluídos." />
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart layout="vertical" data={porMotorista} margin={{ left: 8, right: 24 }}>
                <CartesianGrid horizontal={false} stroke={paleta.grade} />
                <XAxis type="number" allowDecimals={false} {...eixoComum} />
                <YAxis type="category" dataKey="nome" width={120} {...eixoComum} />
                <Tooltip cursor={{ fill: paleta.grade, opacity: 0.4 }} content={<TooltipGrafico />} />
                <Bar dataKey="valor" name="Atendimentos" fill={paleta.serie.atendimentos} radius={[0, 4, 4, 0]} label={{ position: "right", fill: paleta.textoSuave, fontSize: 12 }} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CartaoGrafico>
      </div>
    </div>
  );
}

function Kpi({
  icone,
  rotulo,
  valor,
  cor,
}: {
  icone: React.ReactNode;
  rotulo: string;
  valor: number | string;
  cor: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-card border border-surface-border bg-surface p-4 shadow-card">
      <span
        className="flex h-11 w-11 items-center justify-center rounded-lg text-white"
        style={{ background: cor }}
      >
        {icone}
      </span>
      <div>
        <p className="text-2xl font-bold text-content">{valor}</p>
        <p className="text-xs text-content-muted">{rotulo}</p>
      </div>
    </div>
  );
}
