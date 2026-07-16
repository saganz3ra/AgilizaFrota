import { TextareaHTMLAttributes, forwardRef, useId } from "react";

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
}

/** Área de texto rotulada (descrições). */
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, id, className = "", ...props }, ref) => {
    const gerado = useId();
    const areaId = id || gerado;
    return (
      <div className="flex flex-col gap-1.5">
        <label htmlFor={areaId} className="text-sm font-medium text-content">
          {label}
        </label>
        <textarea
          ref={ref}
          id={areaId}
          className={[
            "min-h-[88px] rounded-lg border border-surface-border bg-surface px-3 py-2 text-sm text-content",
            "placeholder:text-content-muted",
            className,
          ].join(" ")}
          {...props}
        />
      </div>
    );
  },
);

Textarea.displayName = "Textarea";
