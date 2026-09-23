"use client";

import Link from "next/link";
import {
  Ambulance,
  ChevronDown,
  HelpCircle,
  LayoutDashboard,
  LogOut,
  Moon,
  PieChart,
  Settings,
  Sun,
  TrendingUp,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { usePreferencias } from "@/lib/preferencias";
import { MenuSuspenso } from "@/components/ui/MenuSuspenso";

/**
 * Barra superior: marca à esquerda, seletor de painéis (placeholder para os
 * gráficos que virão) e o menu da engrenagem (tema, configurações, sair).
 * O perfil do usuário mora na barra lateral.
 */
export function Topbar() {
  const { sair } = useAuth();

  return (
    <header className="flex h-16 items-center gap-4 border-b border-surface-border bg-surface px-4 sm:px-6">
      {/* Marca */}
      <Link href="/dashboard" className="flex items-center gap-2.5">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand text-brand-contrast">
          <Ambulance size={20} />
        </span>
        <span className="hidden text-[15px] font-bold text-content sm:block">
          Agiliza Frota
        </span>
      </Link>

      <SeletorPainel />

      <div className="ml-auto flex items-center gap-2">
        {/* Aba de ajuda do sistema (equivalente ao "Guia" do print). */}
        <Link
          href="/ajuda"
          className="flex items-center gap-2 rounded-lg border border-surface-border bg-surface px-3 py-2 text-sm font-medium text-content transition-colors hover:bg-surface-muted"
        >
          <HelpCircle size={16} className="text-acento-chamados" />
          <span className="hidden sm:inline">Ajuda</span>
        </Link>

        <MenuConfiguracoes aoSair={() => void sair()} />
      </div>
    </header>
  );
}

/**
 * Seletor de painéis. Hoje só há o "Dashboard principal"; os painéis de
 * gráficos aparecem como "em breve" (desabilitados), para deixar claro que o
 * espaço existe sem prometer o que ainda não foi construído.
 */
function SeletorPainel() {
  return (
    <MenuSuspenso
      rotulo="Selecionar painel"
      classeGatilho="flex items-center gap-2 rounded-lg border border-surface-border bg-surface px-3 py-2 text-sm font-medium text-content transition-colors hover:bg-surface-muted"
      gatilho={
        <>
          <LayoutDashboard size={16} className="text-acento-chamados" />
          <span className="hidden sm:inline">Dashboard principal</span>
          <ChevronDown size={16} className="text-content-muted" />
        </>
      }
    >
      {(fechar) => (
        <div className="flex flex-col">
          <Link
            href="/dashboard"
            onClick={fechar}
            role="menuitem"
            className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-content hover:bg-surface-muted"
          >
            <LayoutDashboard size={16} className="text-acento-chamados" />
            Dashboard principal
          </Link>

          <div className="my-1 border-t border-surface-border" />
          <p className="px-3 pb-1 pt-1 text-xs font-medium uppercase tracking-wide text-content-muted">
            Painéis de gráficos
          </p>

          <Link
            href="/indicadores"
            onClick={fechar}
            role="menuitem"
            className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-content hover:bg-surface-muted"
          >
            <PieChart size={16} className="text-acento-turnos" />
            Indicadores
          </Link>
          <Link
            href="/evolucao"
            onClick={fechar}
            role="menuitem"
            className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-content hover:bg-surface-muted"
          >
            <TrendingUp size={16} className="text-acento-veiculos" />
            Evolução
          </Link>
        </div>
      )}
    </MenuSuspenso>
  );
}

/** Menu da engrenagem: tema, atalho para Configurações e sair. */
function MenuConfiguracoes({ aoSair }: { aoSair: () => void }) {
  const { montado, escuro, alternarTema } = usePreferencias();

  return (
    <MenuSuspenso
      alinhar="direita"
      rotulo="Abrir configurações"
      classeGatilho="flex h-9 w-9 items-center justify-center rounded-lg border border-surface-border text-content-muted transition-colors hover:bg-surface-muted hover:text-content"
      gatilho={<Settings size={18} />}
    >
      {(fechar) => (
        <div className="flex flex-col">
          {/* Não fecha o menu ao trocar o tema: assim dá para ver a mudança. */}
          <button
            type="button"
            onClick={alternarTema}
            disabled={!montado}
            role="menuitem"
            className="flex items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-content hover:bg-surface-muted disabled:opacity-50"
          >
            {escuro ? <Sun size={16} /> : <Moon size={16} />}
            Tema {escuro ? "claro" : "escuro"}
          </button>

          <Link
            href="/configuracoes"
            onClick={fechar}
            role="menuitem"
            className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-content hover:bg-surface-muted"
          >
            <Settings size={16} />
            Configurações
          </Link>

          <div className="my-1 border-t border-surface-border" />

          <button
            type="button"
            onClick={() => {
              fechar();
              aoSair();
            }}
            role="menuitem"
            className="flex items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-prioridade-critica hover:bg-prioridade-critica/10"
          >
            <LogOut size={16} />
            Sair
          </button>
        </div>
      )}
    </MenuSuspenso>
  );
}
