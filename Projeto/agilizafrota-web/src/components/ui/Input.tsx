import { InputHTMLAttributes, forwardRef, useId } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  erro?: string;
}

/** Campo de texto rotulado com estado de erro acessivel. */
export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, erro, id, className = "", ...props }, ref) => {
    const gerado = useId();
    const inputId = id || gerado;
    return (
      <div className="flex flex-col gap-1.5">
        <label htmlFor={inputId} className="text-sm font-medium text-content">
          {label}
        </label>
        <input
          ref={ref}
          id={inputId}
          aria-invalid={erro ? true : undefined}
          className={[
            "h-11 rounded-lg border bg-surface px-3 text-sm text-content",
            "placeholder:text-content-muted",
            erro ? "border-prioridade-critica" : "border-surface-border",
            className,
          ].join(" ")}
          {...props}
        />
        {erro && <span className="text-sm text-prioridade-critica">{erro}</span>}
      </div>
    );
  },
);

Input.displayName = "Input";
