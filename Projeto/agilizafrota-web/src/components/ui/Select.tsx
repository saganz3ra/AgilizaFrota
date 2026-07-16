import { SelectHTMLAttributes, forwardRef, useId } from "react";

interface Opcao {
  valor: string;
  rotulo: string;
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  opcoes: Opcao[];
}

/** Campo de seleção rotulado. */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, opcoes, id, className = "", ...props }, ref) => {
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
          className={[
            "h-11 rounded-lg border border-surface-border bg-surface px-3 text-sm text-content",
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
      </div>
    );
  },
);

Select.displayName = "Select";
