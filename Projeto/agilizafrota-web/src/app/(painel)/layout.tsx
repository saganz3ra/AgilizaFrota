"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { PreferenciasProvider } from "@/lib/preferencias";
import { Sidebar } from "@/components/Sidebar";
import { Topbar } from "@/components/Topbar";
import { OuvinteAtalhos } from "@/components/OuvinteAtalhos";
import { OuvinteChamados } from "@/components/OuvinteChamados";
import { Spinner } from "@/components/ui/Spinner";

/** Layout das telas autenticadas: guarda a sessao e monta o shell. */
export default function PainelLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { usuarioFirebase, perfil, carregando } = useAuth();

  useEffect(() => {
    if (carregando) return;
    if (!usuarioFirebase) {
      router.replace("/login");
      return;
    }
    // A recepção só tem acesso às chegadas (mais configurações e ajuda, que
    // valem para qualquer perfil). O backend já recusaria as demais rotas por
    // RBAC; barrar aqui evita a tela de erro e a sensação de que algo quebrou.
    if (
      perfil?.papel === "recepcionista" &&
      !pathname.startsWith("/chegadas") &&
      !pathname.startsWith("/configuracoes") &&
      !pathname.startsWith("/ajuda")
    ) {
      router.replace("/chegadas");
    }
  }, [carregando, usuarioFirebase, perfil, pathname, router]);

  if (carregando || !usuarioFirebase) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner />
      </div>
    );
  }

  return (
    // Provider aqui (e nao no layout raiz) porque estas preferencias so fazem
    // sentido no app autenticado, e assim tanto a Topbar quanto as telas ficam
    // sob o mesmo estado de tema/som.
    <PreferenciasProvider>
      {/* Ouvintes globais (não renderizam nada): atalhos de teclado e, só para
          a Central, os alertas de novos chamados (som + notificação). */}
      <OuvinteAtalhos />
      {perfil?.papel === "central" && <OuvinteChamados />}
      {/* h-screen + overflow-hidden trava o shell na altura da tela; só o
          <main> rola. Assim a barra lateral e a superior ficam fixas. */}
      <div className="flex h-screen overflow-hidden">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar />
          <main className="flex-1 overflow-auto p-6">{children}</main>
        </div>
      </div>
    </PreferenciasProvider>
  );
}
