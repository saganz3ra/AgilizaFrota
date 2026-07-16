/** Indicador de carregamento simples. */
export function Spinner({ className = "" }: { className?: string }) {
  return (
    <span
      role="status"
      aria-label="Carregando"
      className={[
        "inline-block h-5 w-5 animate-spin rounded-full border-2 border-brand border-t-transparent",
        className,
      ].join(" ")}
    />
  );
}
