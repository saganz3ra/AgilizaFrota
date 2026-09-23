"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { api, ApiError } from "@/lib/api";
import { Chamado, RelatorioResposta } from "@/types/api";
import { Spinner } from "@/components/ui/Spinner";
import { Card, CardBody } from "@/components/ui/Card";
import {
  CartaoGrafico,
  EstadoVazioGrafico,
  TooltipGrafico,
} from "@/components/graficos/Comuns";
import { usePaletaGrafico, ultimosDias, chaveDia, rotuloDia } from "@/lib/graficos";

const PERIODOS = [
  { valor: 7, rotulo: "7 dias" },
  { valor: 30, rotulo: "30 dias" },
  { valor: 90, rotulo: "90 dias" },
];

interface PontoDia {
  dia: string;
  chamados: number;
  atendimentos: number;
  km: number;
}

export default function EvolucaoPage() {
  const paleta = usePaletaGrafico();
  const [periodo, setPeriodo] = useState(30);
  const [chamados, setChamados] = useState<Chamado[]>([]);
  const [operacional, setOperacional] = useState<RelatorioResposta | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    setCarregando(true);
    setErro(null);

    // Intervalo do período escolhido (do início do primeiro dia até agora).
    const inicio = new Date();
    inicio.setDate(inicio.getDate() - (periodo - 1));
    inicio.setHours(0, 0, 0, 0);
    const desde = inicio.toISOString();
    const ate = new Date().toISOString();

    (async () => {
      try {
        const [c, op] = await Promise.all([
          api<{ chamados: Chamado[] }>("/chamados"),
          api<RelatorioResposta>(
            `/relatorios/operacional?formato=json&desde=${encodeURIComponent(
              desde,
            )}&ate=${encodeURIComponent(ate)}`,
          ),
        ]);
        if (!ativo) return;
        setChamados(c.chamados);
        setOperacional(op);
      } catch (e) {
        if (ativo) {
          setErro(e instanceof ApiError ? e.message : "Falha ao carregar a evolução.");
        }
      } finally {
        if (ativo) setCarregando(false);
      }
    })();
    return () => {
      ativo = false;
    };
  }, [periodo]);

  const serie = useMemo<PontoDia[]>(() => {
    const dias = ultimosDias(periodo);
    const mapa = new Map<string, PontoDia>();
    for (const k of dias) mapa.set(k, { dia: k, chamados: 0, atendimentos: 0, km: 0 });

    for (const c of chamados) {
      const p = mapa.get(chaveDia(c.aberto_em));
      if (p) p.chamados += 1;
    }
    for (const l of operacional?.linhas ?? []) {
      const p = mapa.get(chaveDia(l.inicio_em as string));
      if (p) {
        p.atendimentos += 1;
        p.km += Number(l.distancia_total_km ?? 0);
      }
    }
    // Rótulo curto DD/MM para o eixo.
    return dias.map((k) => {
      const p = mapa.get(k)!;
      return { ...p, dia: rotuloDia(k) };
    });
  }, [chamados, operacional, periodo]);

  const semDados = serie.every((p) => p.chamados === 0 && p.atendimentos === 0 && p.km === 0);

  const eixoComum = { stroke: paleta.textoSuave, fontSize: 12, tickLine: false } as const;
  // Menos marcações de dia quando o período é longo, para o eixo não lotar.
  const intervaloEixo = periodo <= 7 ? 0 : periodo <= 30 ? 3 : 9;

  const seletorPeriodo = (
    <div className="flex gap-1">
      {PERIODOS.map((p) => (
        <button
          key={p.valor}
          type="button"
          onClick={() => setPeriodo(p.valor)}
          className={[
            "rounded-lg px-2.5 py-1 text-xs font-medium transition-colors",
            periodo === p.valor
              ? "bg-brand text-brand-contrast"
              : "text-content-muted hover:bg-surface-muted",
          ].join(" ")}
        >
          {p.rotulo}
        </button>
      ))}
    </div>
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-content">Evolução</h1>
          <p className="text-sm text-content-muted">
            Chamados, atendimentos e quilometragem ao longo do tempo.
          </p>
        </div>
        {seletorPeriodo}
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
      ) : (
        <div className="flex flex-col gap-4">
          <CartaoGrafico
            titulo="Chamados e atendimentos por dia"
            subtitulo="Demanda que entrou x transportes iniciados"
          >
            {semDados ? (
              <EstadoVazioGrafico texto="Sem registros no período." />
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={serie} margin={{ left: 4, right: 16, top: 8 }}>
                  <CartesianGrid vertical={false} stroke={paleta.grade} />
                  <XAxis dataKey="dia" interval={intervaloEixo} {...eixoComum} />
                  <YAxis allowDecimals={false} width={32} {...eixoComum} />
                  <Tooltip content={<TooltipGrafico />} />
                  <Legend
                    iconType="plainline"
                    formatter={(v) => <span className="text-xs text-content-muted">{v}</span>}
                  />
                  <Line
                    type="monotone"
                    dataKey="chamados"
                    name="Chamados"
                    stroke={paleta.serie.chamados}
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="atendimentos"
                    name="Atendimentos"
                    stroke={paleta.serie.atendimentos}
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CartaoGrafico>

          <CartaoGrafico titulo="Quilometragem por dia" subtitulo="Soma da distância dos atendimentos">
            {semDados ? (
              <EstadoVazioGrafico texto="Sem registros no período." />
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={serie} margin={{ left: 4, right: 16, top: 8 }}>
                  <defs>
                    <linearGradient id="grad-km" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={paleta.serie.km} stopOpacity={0.35} />
                      <stop offset="100%" stopColor={paleta.serie.km} stopOpacity={0.03} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke={paleta.grade} />
                  <XAxis dataKey="dia" interval={intervaloEixo} {...eixoComum} />
                  <YAxis allowDecimals={false} width={40} {...eixoComum} />
                  <Tooltip content={<TooltipGrafico />} />
                  <Area
                    type="monotone"
                    dataKey="km"
                    name="Km"
                    stroke={paleta.serie.km}
                    strokeWidth={2}
                    fill="url(#grad-km)"
                    activeDot={{ r: 4 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CartaoGrafico>
        </div>
      )}
    </div>
  );
}
