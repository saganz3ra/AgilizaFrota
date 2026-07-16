"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Sidebar } from "@/components/Sidebar";
import { Topbar } from "@/components/Topbar";
import { Spinner } from "@/components/ui/Spinner";

/** Layout das telas autenticadas: guarda a sessao e monta o shell. */
export default function PainelLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { usuarioFirebase, carregando } = useAuth();

  useEffect(() => {
    if (!carregando && !usuarioFirebase) router.replace("/login");
  }, [carregando, usuarioFirebase, router]);

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
