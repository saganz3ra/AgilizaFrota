import { ButtonHTMLAttributes, forwardRef } from "react";

type Variante =
  | "primario"
  | "secundario"
  | "ghost"
  | "perigo"
  | "perigoGhost"
  | "neutroGhost";
type Tamanho = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: Variante;
  tamanho?: Tamanho;
  carregando?: boolean;
}

const estilosVariante: Record<Variante, string> = {
  primario:
    "bg-brand text-brand-contrast hover:bg-brand-dark disabled:bg-brand/50",
  secundario:
    "bg-surface text-content border border-surface-border hover:bg-surface-muted",
  ghost: "bg-transparent text-brand hover:bg-brand-light",
  perigo: "bg-prioridade-critica text-white hover:opacity-90",
  // Acao destrutiva de baixo peso (ex.: "Cancelar", "Desativar" numa linha):
  // vermelho, sem fundo cheio, para nao competir com a acao primaria. O
  // vermelho vem do token de prioridade (clareia no escuro p/ continuar legivel).
  perigoGhost:
    "bg-transparent text-prioridade-critica hover:bg-prioridade-critica/10",
  // Acao neutra de baixo peso (ex.: "Editar"): usa a cor de conteudo, que e
  // quase-preta no tema claro e quase-branca no escuro - um so token cobre
  // os dois temas, sem precisar de classe `dark:`.
  neutroGhost: "bg-transparent text-content hover:bg-surface-muted",
};

const estilosTamanho: Record<Tamanho, string> = {
  sm: "h-9 px-3 text-sm",
  md: "h-11 px-4 text-sm",
  lg: "h-12 px-6 text-base",
};

/** Botao base do design system. Alvos amplos e foco visivel (uso sob pressao). */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variante = "primario", tamanho = "md", carregando, className = "", children, disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || carregando}
        className={[
          "inline-flex items-center justify-center gap-2 rounded-lg font-medium",
          "transition-colors disabled:cursor-not-allowed",
          estilosVariante[variante],
          estilosTamanho[tamanho],
          className,
        ].join(" ")}
        {...props}
      >
        {carregando && (
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
        )}
        {children}
      </button>
    );
  },
);

Button.displayName = "Button";
