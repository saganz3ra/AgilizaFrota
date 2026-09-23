"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  ReactNode,
} from "react";
import { sonsAtivos, definirSons } from "./som";
import { lerAtalhos, gravarAtalhos, MapaAtalhos } from "./atalhos";
import {
  notificacoesAtivas,
  definirNotificacoes,
  pedirPermissao,
} from "./notificacoes";

export type Fonte = "pequeno" | "padrao" | "grande";
export type Densidade = "confortavel" | "compacto";

/**
 * Preferencias de interface do usuario (tema e som), por navegador.
 *
 * Por que um Context, e nao estado local em cada botao: o tema pode ser
 * alternado tanto pelo atalho na barra superior quanto pela tela de
 * Configuracoes. Com um Context, os dois leem e escrevem o MESMO estado e
 * ficam sincronizados; com estado local, um nao saberia da mudanca do outro.
 *
 * Nenhuma dessas preferencias vai para o backend: nao mudam regra de negocio,
 * sao escolhas de quem esta usando aquele navegador (RNF04 - conforto de uso).
 */
interface PreferenciasContextValue {
  /** Falso ate montar no cliente; evita decidir icones no servidor. */
  montado: boolean;
  escuro: boolean;
  alternarTema: () => void;
  som: boolean;
  alternarSom: () => void;
  /** Atalhos de teclado: mapa href -> tecla. */
  atalhos: MapaAtalhos;
  definirAtalho: (href: string, tecla: string) => void;
  removerAtalho: (href: string) => void;
  /** Ligado enquanto a tela de Configuracoes captura uma tecla, para o
   *  ouvinte global de atalhos nao navegar durante a captura. */
  capturando: boolean;
  setCapturando: (v: boolean) => void;
  /** Aparencia: tamanho da fonte e densidade (reescalam a fonte raiz). */
  fonte: Fonte;
  definirFonte: (v: Fonte) => void;
  densidade: Densidade;
  definirDensidade: (v: Densidade) => void;
  animacoesReduzidas: boolean;
  alternarAnimacoes: () => void;
  /** Tela para onde a Central vai ao entrar (rota). */
  telaInicial: string;
  definirTelaInicial: (href: string) => void;
  /** Notificacoes do navegador para novos chamados. */
  notificacoes: boolean;
  /** Liga/desliga; ao ligar, pede permissao ao navegador. */
  alternarNotificacoes: () => Promise<void>;
}

const PreferenciasContext = createContext<PreferenciasContextValue | undefined>(
  undefined,
);

export function PreferenciasProvider({ children }: { children: ReactNode }) {
  const [montado, setMontado] = useState(false);
  const [escuro, setEscuro] = useState(false);
  const [som, setSom] = useState(true);
  const [atalhos, setAtalhos] = useState<MapaAtalhos>({});
  const [capturando, setCapturando] = useState(false);
  const [fonte, setFonte] = useState<Fonte>("padrao");
  const [densidade, setDensidade] = useState<Densidade>("confortavel");
  const [animacoesReduzidas, setAnimacoesReduzidas] = useState(false);
  const [telaInicial, setTelaInicial] = useState("/dashboard");
  const [notificacoes, setNotificacoes] = useState(false);

  // A classe .dark e os atributos de aparencia ja foram aplicados pelo script
  // anti-flash do layout raiz. Aqui apenas LEMOS o estado resultante (e as
  // demais preferencias salvas) para o React refletir os mesmos valores - a
  // fonte da verdade continua sendo o DOM/localStorage.
  useEffect(() => {
    setEscuro(document.documentElement.classList.contains("dark"));
    setSom(sonsAtivos());
    setAtalhos(lerAtalhos());
    setNotificacoes(notificacoesAtivas());
    try {
      const f = localStorage.getItem("fonte");
      if (f === "pequeno" || f === "grande" || f === "padrao") setFonte(f);
      const d = localStorage.getItem("densidade");
      if (d === "compacto" || d === "confortavel") setDensidade(d);
      setAnimacoesReduzidas(localStorage.getItem("animacoes") === "reduzidas");
      const t = localStorage.getItem("telaInicial");
      if (t) setTelaInicial(t);
    } catch {
      /* localStorage indisponivel: mantem os padroes */
    }
    setMontado(true);
  }, []);

  function alternarTema() {
    setEscuro((atual) => {
      const proximo = !atual;
      document.documentElement.classList.toggle("dark", proximo);
      try {
        localStorage.setItem("tema", proximo ? "escuro" : "claro");
      } catch {
        /* localStorage indisponivel: vale so nesta sessao */
      }
      return proximo;
    });
  }

  function alternarSom() {
    setSom((atual) => {
      const proximo = !atual;
      definirSons(proximo);
      return proximo;
    });
  }

  function definirAtalho(href: string, tecla: string) {
    setAtalhos((atual) => {
      // Uma tecla vale para UMA tela: se ja estava em outra, tira de la antes.
      const proximo: MapaAtalhos = {};
      for (const [h, k] of Object.entries(atual)) {
        if (k !== tecla) proximo[h] = k;
      }
      proximo[href] = tecla;
      gravarAtalhos(proximo);
      return proximo;
    });
  }

  function removerAtalho(href: string) {
    setAtalhos((atual) => {
      const resto: MapaAtalhos = {};
      for (const [h, k] of Object.entries(atual)) {
        if (h !== href) resto[h] = k;
      }
      gravarAtalhos(resto);
      return resto;
    });
  }

  // Aparencia: além de guardar, aplicam o atributo no <html> na hora, para a
  // interface reescalar imediatamente (o CSS reage a data-fonte/data-densidade).
  function persistir(chave: string, valor: string) {
    try {
      localStorage.setItem(chave, valor);
    } catch {
      /* localStorage indisponivel */
    }
  }

  function definirFonte(v: Fonte) {
    document.documentElement.setAttribute("data-fonte", v);
    persistir("fonte", v);
    setFonte(v);
  }

  function definirDensidade(v: Densidade) {
    document.documentElement.setAttribute("data-densidade", v);
    persistir("densidade", v);
    setDensidade(v);
  }

  function alternarAnimacoes() {
    setAnimacoesReduzidas((atual) => {
      const proximo = !atual;
      document.documentElement.setAttribute(
        "data-animacoes",
        proximo ? "reduzidas" : "normais",
      );
      persistir("animacoes", proximo ? "reduzidas" : "normais");
      return proximo;
    });
  }

  function definirTelaInicial(href: string) {
    persistir("telaInicial", href);
    setTelaInicial(href);
  }

  async function alternarNotificacoes() {
    if (notificacoes) {
      definirNotificacoes(false);
      setNotificacoes(false);
      return;
    }
    // Ao LIGAR, precisa da permissao do navegador. Se negada, nao liga.
    const ok = await pedirPermissao();
    definirNotificacoes(ok);
    setNotificacoes(ok);
  }

  const valor = useMemo(
    () => ({
      montado,
      escuro,
      alternarTema,
      som,
      alternarSom,
      atalhos,
      definirAtalho,
      removerAtalho,
      capturando,
      setCapturando,
      fonte,
      definirFonte,
      densidade,
      definirDensidade,
      animacoesReduzidas,
      alternarAnimacoes,
      telaInicial,
      definirTelaInicial,
      notificacoes,
      alternarNotificacoes,
    }),
    [
      montado,
      escuro,
      som,
      atalhos,
      capturando,
      fonte,
      densidade,
      animacoesReduzidas,
      telaInicial,
      notificacoes,
    ],
  );

  return (
    <PreferenciasContext.Provider value={valor}>
      {children}
    </PreferenciasContext.Provider>
  );
}

export function usePreferencias(): PreferenciasContextValue {
  const ctx = useContext(PreferenciasContext);
  if (!ctx) {
    throw new Error(
      "usePreferencias deve ser usado dentro de <PreferenciasProvider>.",
    );
  }
  return ctx;
}
