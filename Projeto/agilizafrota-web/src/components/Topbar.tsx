"use client";

import { LogOut } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/Button";

/** Barra superior com identificacao do usuario e logout. */
export function Topbar() {
  const { perfil, sair } = useAuth();
  const iniciais = (perfil?.nome || "?")
    .split(" ")
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();

  return (
    <header className="flex h-16 items-center justify-between border-b border-surface-border bg-surface px-6">
      <div>
        <p className="text-sm font-semibold text-content">Central de Operações</p>
        <p className="text-xs text-content-muted">Gestão de frota hospitalar</p>
      </div>
      <div className="flex items-center gap-3">
        <div className="text-right">
          <p className="text-sm font-medium text-content">{perfil?.nome}</p>
          <p className="text-xs capitalize text-content-muted">{perfil?.papel}</p>
        </div>
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-light text-sm font-semibold text-brand">
          {iniciais}
        </span>
        <Button variante="secundario" tamanho="sm" onClick={() => void sair()}>
          <LogOut size={16} />
          Sair
        </Button>
      </div>
    </header>
  );
}
