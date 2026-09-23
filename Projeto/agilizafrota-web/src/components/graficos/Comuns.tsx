"use client";

import { ReactNode } from "react";

/** Moldura padrão de um gráfico: título, subtítulo e uma ação opcional. */
export function CartaoGrafico({
  titulo,
  subtitulo,
  acao,
  children,
}: {
  titulo: string;
  subtitulo?: string;
  acao?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="rounded-card border border-surface-border bg-surface p-4 shadow-card">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-content">{titulo}</h2>
          {subtitulo && <p className="text-xs text-content-muted">{subtitulo}</p>}
        </div>
        {acao}
      </div>
      {children}
    </div>
  );
}

/** Mensagem quando não há dados para o gráfico. */
export function EstadoVazioGrafico({ texto }: { texto: string }) {
  return (
    <div className="flex h-[240px] items-center justify-center text-sm text-content-muted">
      {texto}
    </div>
  );
}

type ItemTooltip = {
  name?: string;
  value?: number | string;
  color?: string;
  fill?: string;
  payload?: { cor?: string };
};

/**
 * Tooltip do Recharts com os tokens do app (o padrão vem branco, sem tema).
 * O texto usa os tokens de conteúdo; a cor só aparece no pontinho ao lado —
 * identidade nunca fica só na cor.
 */
export function TooltipGrafico({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: ItemTooltip[];
  label?: string | number;
}) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded-lg border border-surface-border bg-surface px-3 py-2 text-xs shadow-card">
      {label !== undefined && label !== "" && (
        <p className="mb-1 font-medium text-content">{label}</p>
      )}
      {payload.map((p, i) => (
        <p key={i} className="flex items-center gap-2 text-content-muted">
          <span
            className="h-2 w-2 rounded-full"
            style={{ background: p.payload?.cor || p.color || p.fill }}
          />
          {p.name}:{" "}
          <span className="font-semibold text-content">{p.value}</span>
        </p>
      ))}
    </div>
  );
}
