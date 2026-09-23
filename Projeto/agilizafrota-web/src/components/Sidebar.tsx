"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { Unidade } from "@/types/api";
import {
  LayoutDashboard,
  PhoneCall,
  Truck,
  Building2,
  Users,
  ClipboardList,
  MapPinned,
  BellRing,
  Stethoscope,
  FileBarChart2,
  History,
  Route,
  ShieldCheck,
} from "lucide-react";

/**
 * Navegação da Central: gerencia a operação inteira.
 */
const ITENS_CENTRAL = [
  { href: "/dashboard", rotulo: "Painel", icone: LayoutDashboard },
  { href: "/chamados", rotulo: "Chamados", icone: PhoneCall },
  { href: "/frota", rotulo: "Frota", icone: MapPinned },
  { href: "/atendimentos", rotulo: "Atendimentos", icone: Stethoscope },
  { href: "/rotas", rotulo: "Rotas e ETA", icone: Route },
  { href: "/chegadas", rotulo: "Chegadas", icone: BellRing },
  { href: "/historico", rotulo: "Histórico", icone: History },
  { href: "/relatorios", rotulo: "Relatórios", icone: FileBarChart2 },
  { href: "/auditoria", rotulo: "Auditoria", icone: ShieldCheck },
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

/** Rótulo amigável do papel (o backend usa a chave técnica). */
const ROTULO_PAPEL: Record<string, string> = {
  central: "Operador da Central",
  recepcionista: "Recepção",
  motorista: "Motorista",
};

/** Iniciais do nome, para o avatar do perfil. */
function iniciaisDe(nome: string | undefined): string {
  return (nome || "?")
    .split(" ")
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
}

/**
 * Navegação lateral do painel. Moldura em azul-marinho (identidade
 * institucional), com o item ativo em verde — a mesma linguagem visual do
 * app do motorista.
 *
 * No topo fica o perfil (nome, hospital vinculado e cargo); a marca do sistema
 * mora na barra superior.
 */
export function Sidebar() {
  const pathname = usePathname();
  const { perfil } = useAuth();
  const itens = perfil?.papel === "recepcionista" ? ITENS_RECEPCAO : ITENS_CENTRAL;

  // Hospital (unidade) vinculado ao perfil. O /auth/me traz só o `unidade_id`,
  // então resolvemos o nome aqui em /unidades. O operador da Central em geral
  // não tem unidade — mostramos "Central de Operações". Se a busca falhar (ex.:
  // papel sem acesso a /unidades), a linha do hospital simplesmente não aparece.
  const [hospital, setHospital] = useState<string | null>(null);
  useEffect(() => {
    const id = perfil?.unidade_id;
    if (!id) {
      setHospital(null);
      return;
    }
    let ativo = true;
    (async () => {
      try {
        const { unidades } = await api<{ unidades: Unidade[] }>("/unidades");
        if (ativo) setHospital(unidades.find((u) => u.id === id)?.nome ?? null);
      } catch {
        /* sem acesso a /unidades: mostra só o cargo */
      }
    })();
    return () => {
      ativo = false;
    };
  }, [perfil?.unidade_id]);

  const cargo = perfil ? ROTULO_PAPEL[perfil.papel] ?? perfil.papel : "";
  const filial =
    hospital ?? (perfil?.papel === "central" ? "Central de Operações" : null);

  return (
    <aside className="hidden w-64 shrink-0 flex-col bg-marinho text-white md:flex">
      {/* Perfil (topo) */}
      <div className="flex items-center gap-3 border-b border-white/10 px-4 py-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand text-sm font-semibold text-brand-contrast">
          {iniciaisDe(perfil?.nome)}
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-white">
            {perfil?.nome ?? "—"}
          </p>
          <p className="truncate text-xs text-slate-300">{cargo}</p>
          {filial && (
            <p className="truncate text-xs text-slate-400">{filial}</p>
          )}
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-3">
        {itens.map(({ href, rotulo, icone: Icone }) => {
          const ativo = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              className={[
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                ativo
                  ? "bg-brand text-white shadow-sm"
                  : "text-slate-300 hover:bg-white/10 hover:text-white",
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
