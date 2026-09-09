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
import { api, ApiError } from "./api";
import { Usuario } from "@/types/api";

interface AuthContextValue {
  usuarioFirebase: User | null;
  perfil: Usuario | null;
  erroPerfil: ApiError | null;
  carregando: boolean;
  entrar: (email: string, senha: string) => Promise<void>;
  sair: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuarioFirebase, setUsuarioFirebase] = useState<User | null>(null);
  const [perfil, setPerfil] = useState<Usuario | null>(null);
  const [erroPerfil, setErroPerfil] = useState<ApiError | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    const cancelar = onAuthStateChanged(auth, async (u) => {
      setUsuarioFirebase(u);
      if (u) {
        try {
          const { usuario } = await api<{ usuario: Usuario }>("/auth/me");
          setPerfil(usuario);
          setErroPerfil(null);
        } catch (e) {
          // Guarda o erro real (404 sem perfil, 403 token invalido, sem conexao...).
          setPerfil(null);
          setErroPerfil(e instanceof ApiError ? e : new ApiError(0, "Erro desconhecido"));
        }
      } else {
        setPerfil(null);
        setErroPerfil(null);
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
    setErroPerfil(null);
  }

  const valor = useMemo(
    () => ({ usuarioFirebase, perfil, erroPerfil, carregando, entrar, sair }),
    [usuarioFirebase, perfil, erroPerfil, carregando],
  );

  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth deve ser usado dentro de <AuthProvider>.");
  return ctx;
}
