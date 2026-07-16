import { ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  className?: string;
}

/** Container padrao de conteudo (superficie branca com sombra suave). */
export function Card({ children, className = "" }: CardProps) {
  return (
    <div
      className={[
        "rounded-card border border-surface-border bg-surface shadow-card",
        className,
      ].join(" ")}
    >
      {children}
    </div>
  );
}

export function CardHeader({ children, className = "" }: CardProps) {
  return (
    <div className={["border-b border-surface-border px-5 py-4", className].join(" ")}>
      {children}
    </div>
  );
}

export function CardBody({ children, className = "" }: CardProps) {
  return <div className={["px-5 py-4", className].join(" ")}>{children}</div>;
}
