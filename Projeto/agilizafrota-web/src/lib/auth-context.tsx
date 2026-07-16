"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  ReactNode,
} from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  User,
} from "firebase/auth";
import { auth } from "./firebase";
import { api } from "./api";
import { Usuario } from "@/types/api";

interface AuthContextValue {
  usuarioFirebase: User | null;
  perfil: Usuario | null;
  carregando: boolean;
  entrar: (email: string, senha: string) => Promise<void>;
  sair: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuarioFirebase, setUsuarioFirebase] = useState<User | null>(null);
  const [perfil, setPerfil] = useState<Usuario | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    const cancelar = onAuthStateChanged(auth, async (u) => {
      setUsuarioFirebase(u);
      if (u) {
        try {
          const { usuario } = await api<{ usuario: Usuario }>("/auth/me");
          setPerfil(usuario);
        } catch {
          // Autenticado no Firebase, mas sem perfil no sistema.
          setPerfil(null);
        }
      } else {
        setPerfil(null);
      }
      setCarregando(false);
    });
    return () => cancelar();
  }, []);

  async function entrar(email: string, senha: string) {
    await signInWithEmailAndPassword(auth, email, senha);
    // O perfil e carregado pelo listener onAuthStateChanged.
  }

  async function sair() {
    await signOut(auth);
    setPerfil(null);
  }

  const valor = useMemo(
    () => ({ usuarioFirebase, perfil, carregando, entrar, sair }),
    [usuarioFirebase, perfil, carregando],
  );

  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth deve ser usado dentro de <AuthProvider>.");
  return ctx;
}
