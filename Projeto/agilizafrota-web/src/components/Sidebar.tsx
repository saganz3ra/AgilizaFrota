"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Ambulance,
  LayoutDashboard,
  PhoneCall,
  Truck,
  Building2,
  Users,
  ClipboardList,
} from "lucide-react";

const ITENS = [
  { href: "/dashboard", rotulo: "Painel", icone: LayoutDashboard },
  { href: "/chamados", rotulo: "Chamados", icone: PhoneCall },
  { href: "/veiculos", rotulo: "Veículos", icone: Truck },
  { href: "/turnos", rotulo: "Turnos", icone: ClipboardList },
  { href: "/unidades", rotulo: "Unidades", icone: Building2 },
  { href: "/usuarios", rotulo: "Usuários", icone: Users },
];

/** Navegacao lateral do painel. Itens ainda sem tela levam a rotas futuras. */
export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r border-surface-border bg-surface md:flex">
      <div className="flex items-center gap-2 px-5 py-4">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand text-brand-contrast">
          <Ambulance size={20} />
        </span>
        <span className="font-bold text-content">Agiliza Frota</span>
      </div>
      <nav className="flex flex-1 flex-col gap-1 px-3 py-2">
        {ITENS.map(({ href, rotulo, icone: Icone }) => {
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
