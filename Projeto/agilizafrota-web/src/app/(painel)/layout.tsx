"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Sidebar } from "@/components/Sidebar";
import { Topbar } from "@/components/Topbar";
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
    // A recepção só tem acesso às chegadas. O backend já recusaria as demais
    // rotas por RBAC; barrar aqui evita a tela de erro e a sensação de que
    // algo quebrou.
    if (perfil?.papel === "recepcionista" && !pathname.startsWith("/chegadas")) {
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
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>
    </div>
  );
}
