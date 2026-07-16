"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Spinner } from "@/components/ui/Spinner";

/** Rota raiz: encaminha para o dashboard ou o login conforme a sessao. */
export default function Home() {
  const router = useRouter();
  const { usuarioFirebase, carregando } = useAuth();

  useEffect(() => {
    if (carregando) return;
    router.replace(usuarioFirebase ? "/dashboard" : "/login");
  }, [carregando, usuarioFirebase, router]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <Spinner />
    </div>
  );
}
