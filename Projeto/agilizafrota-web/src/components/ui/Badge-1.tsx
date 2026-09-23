import { ReactNode } from "react";

type Tom = "neutro" | "disponivel" | "uso" | "manutencao" | "critica" | "alta" | "media" | "baixa";

// Base comum de layout. A FORMA (rounded) e o preenchimento ficam em cada
// tom, porque status e prioridade tem tratamentos visuais diferentes:
//  - status: pilula discreta (tinta leve + texto colorido), so contexto;
//  - prioridade: bloco solido de cor cheia, para ser visto de relance numa
//    fila de chamados (o operador tria por prioridade antes de ler o texto).
const base = "inline-flex items-center px-2.5 py-0.5 text-xs font-semibold";

const estilos: Record<Tom, string> = {
  neutro: "rounded-full bg-surface-muted text-content-muted",
  disponivel: "rounded-full bg-status-disponivel/10 text-status-disponivel",
  uso: "rounded-full bg-status-uso/10 text-status-uso",
  manutencao: "rounded-full bg-status-manutencao/10 text-status-manutencao",

  // Prioridades: bloco solido (fundo cheio) + texto branco, em maiuscula,
  // para maxima legibilidade a distancia. As cores solidas sao constantes
  // nos dois temas (ver globals.css).
  // w-20 + justify-center: todos os blocos ficam com a MESMA largura,
  // independentemente do texto ("CRITICA" x "ALTA"), para o titulo que vem
  // depois alinhar na mesma coluna em todas as linhas.
  critica: "w-20 justify-center rounded-md bg-prioridade-critica-solida text-white uppercase tracking-wide",
  alta: "w-20 justify-center rounded-md bg-prioridade-alta-solida text-white uppercase tracking-wide",
  media: "w-20 justify-center rounded-md bg-prioridade-media-solida text-white uppercase tracking-wide",
  baixa: "w-20 justify-center rounded-md bg-prioridade-baixa-solida text-white uppercase tracking-wide",
};

/** Etiqueta de status/prioridade com cor semantica. */
export function Badge({ tom = "neutro", children }: { tom?: Tom; children: ReactNode }) {
  return <span className={[base, estilos[tom]].join(" ")}>{children}</span>;
}
