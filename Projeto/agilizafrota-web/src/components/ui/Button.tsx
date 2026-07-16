import { ButtonHTMLAttributes, forwardRef } from "react";

type Variante = "primario" | "secundario" | "ghost" | "perigo";
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
