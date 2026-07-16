import { ReactNode } from "react";

type Tom = "neutro" | "disponivel" | "uso" | "manutencao" | "critica" | "alta" | "media" | "baixa";

const estilos: Record<Tom, string> = {
  neutro: "bg-surface-muted text-content-muted",
  disponivel: "bg-status-disponivel/10 text-status-disponivel",
  uso: "bg-status-uso/10 text-status-uso",
  manutencao: "bg-status-manutencao/10 text-status-manutencao",
  critica: "bg-prioridade-critica/10 text-prioridade-critica",
  alta: "bg-prioridade-alta/10 text-prioridade-alta",
  media: "bg-prioridade-media/10 text-prioridade-media",
  baixa: "bg-prioridade-baixa/10 text-prioridade-baixa",
};

/** Etiqueta de status/prioridade com cor semantica. */
export function Badge({ tom = "neutro", children }: { tom?: Tom; children: ReactNode }) {
  return (
    <span
      className={[
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
        estilos[tom],
      ].join(" ")}
    >
      {children}
    </span>
  );
}
