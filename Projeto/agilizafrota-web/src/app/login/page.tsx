"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Ambulance } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

// Perfis que podem usar o painel web (o motorista usa o app mobile).
const PAPEIS_WEB = ["central", "recepcionista"] as const;

export default function LoginPage() {
  const router = useRouter();
  const { usuarioFirebase, perfil, erroPerfil, carregando, entrar, sair } = useAuth();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  // Após autenticar, valida o perfil e redireciona (ou mostra a causa real).
  useEffect(() => {
    if (carregando || !usuarioFirebase) return;
    if (perfil === null) {
      // Traduz o erro real do /auth/me em vez de assumir "sem perfil".
      let msg = "Não foi possível carregar seu perfil.";
      switch (erroPerfil?.codigo) {
        case "PERFIL_NAO_PROVISIONADO":
          msg = "Sua conta ainda não tem perfil no sistema. Rode o comando criar-central no backend.";
          break;
        case "USUARIO_INATIVO":
          msg = "Sua conta está inativa. Peça para reativá-la.";
          break;
        case "TOKEN_INVALIDO":
          msg = "Token inválido: o app web e o backend podem estar em projetos Firebase diferentes.";
          break;
        case "FIREBASE_INDISPONIVEL":
          msg = "O backend está sem a chave do Firebase (firebase-key.json).";
          break;
        case "SEM_CONEXAO":
          msg = "Sem conexão com a API. O backend está rodando na porta certa?";
          break;
        default:
          if (erroPerfil) msg = `Erro ao carregar o perfil (${erroPerfil.status}). ${erroPerfil.message}`;
      }
      setErro(msg);
      void sair();
      return;
    }
    if (!PAPEIS_WEB.includes(perfil.papel as (typeof PAPEIS_WEB)[number])) {
      setErro("Este painel é para a Central. Motoristas usam o aplicativo.");
      void sair();
      return;
    }
    // Cada perfil entra direto no que usa: a recepção não tem nada a
    // fazer no painel de gestão da Central.
    router.replace(perfil?.papel === "recepcionista" ? "/chegadas" : "/dashboard");
  }, [carregando, usuarioFirebase, perfil, erroPerfil, router, sair]);

  async function aoEnviar(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setEnviando(true);
    try {
      await entrar(email, senha);
    } catch {
      setErro("E-mail ou senha inválidos.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-surface-muted px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand text-brand-contrast">
            <Ambulance size={28} />
          </span>
          <h1 className="text-xl font-bold text-content">Agiliza Frota</h1>
          <p className="text-sm text-content-muted">Painel da Central</p>
        </div>

        <form
          onSubmit={aoEnviar}
          className="flex flex-col gap-4 rounded-card border border-surface-border bg-surface p-6 shadow-card"
        >
          <Input
            label="E-mail"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="voce@hospital.gov.br"
          />
          <Input
            label="Senha"
            type="password"
            autoComplete="current-password"
            required
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            placeholder="••••••••"
          />

          {erro && (
            <p className="rounded-lg bg-prioridade-critica/10 px-3 py-2 text-sm text-prioridade-critica">
              {erro}
            </p>
          )}

          <Button type="submit" tamanho="lg" carregando={enviando}>
            Entrar
          </Button>
        </form>
      </div>
    </main>
  );
}
