import { SelectHTMLAttributes, forwardRef, useId } from "react";

interface Opcao {
  valor: string;
  rotulo: string;
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  opcoes: Opcao[];
  erro?: string;
}

/** Campo de seleção rotulado, com estado de erro acessível (como o Input). */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, opcoes, erro, id, className = "", ...props }, ref) => {
    const gerado = useId();
    const selectId = id || gerado;
    return (
      <div className="flex flex-col gap-1.5">
        <label htmlFor={selectId} className="text-sm font-medium text-content">
          {label}
        </label>
        <select
          ref={ref}
          id={selectId}
          aria-invalid={erro ? true : undefined}
          className={[
            "h-11 rounded-lg border bg-surface px-3 text-sm text-content",
            erro ? "border-prioridade-critica" : "border-surface-border",
            className,
          ].join(" ")}
          {...props}
        >
          {opcoes.map((o) => (
            <option key={o.valor} value={o.valor}>
              {o.rotulo}
            </option>
          ))}
        </select>
        {erro && <span className="text-sm text-prioridade-critica">{erro}</span>}
      </div>
    );
  },
);

Select.displayName = "Select";
