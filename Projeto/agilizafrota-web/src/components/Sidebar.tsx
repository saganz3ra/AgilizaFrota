"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import {
  Ambulance,
  LayoutDashboard,
  PhoneCall,
  Truck,
  Building2,
  Users,
  ClipboardList,
  MapPinned,
  BellRing,
  Stethoscope,
} from "lucide-react";

/**
 * Navegação da Central: gerencia a operação inteira.
 */
const ITENS_CENTRAL = [
  { href: "/dashboard", rotulo: "Painel", icone: LayoutDashboard },
  { href: "/chamados", rotulo: "Chamados", icone: PhoneCall },
  { href: "/frota", rotulo: "Frota", icone: MapPinned },
  { href: "/atendimentos", rotulo: "Atendimentos", icone: Stethoscope },
  { href: "/chegadas", rotulo: "Chegadas", icone: BellRing },
  { href: "/veiculos", rotulo: "Veículos", icone: Truck },
  { href: "/turnos", rotulo: "Turnos", icone: ClipboardList },
  { href: "/unidades", rotulo: "Unidades", icone: Building2 },
  { href: "/usuarios", rotulo: "Usuários", icone: Users },
];

/**
 * Navegação da recepção hospitalar: só o que lhe compete.
 *
 * Ela não gerencia frota nem cadastros — precisa saber qual ambulância está
 * chegando para preparar a entrada. Mostrar as telas da Central seria ruído,
 * e ainda daria a impressão de acesso que o backend recusaria de qualquer
 * forma (as rotas de gestão exigem o papel `central`).
 */
const ITENS_RECEPCAO = [
  { href: "/chegadas", rotulo: "Chegadas", icone: BellRing },
];

/** Navegacao lateral do painel. Itens ainda sem tela levam a rotas futuras. */
export function Sidebar() {
  const pathname = usePathname();
  const { perfil } = useAuth();
  const itens = perfil?.papel === "recepcionista" ? ITENS_RECEPCAO : ITENS_CENTRAL;
  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r border-surface-border bg-surface md:flex">
      <div className="flex items-center gap-2 px-5 py-4">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand text-brand-contrast">
          <Ambulance size={20} />
        </span>
        <span className="font-bold text-content">Agiliza Frota</span>
      </div>
      <nav className="flex flex-1 flex-col gap-1 px-3 py-2">
        {itens.map(({ href, rotulo, icone: Icone }) => {
          const ativo = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              className={[
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                ativo
                  ? "bg-brand-light text-brand"
                  : "text-content-muted hover:bg-surface-muted hover:text-content",
              ].join(" ")}
            >
              <Icone size={18} />
              {rotulo}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
