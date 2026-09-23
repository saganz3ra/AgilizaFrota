import type { Config } from "tailwindcss";

/**
 * Design system - Agiliza Frota.
 * Verde (acao) + azul-marinho (moldura) + branco + cinza claro.
 * As cores usam variaveis CSS definidas em globals.css para facilitar temas.
 */
const config: Config = {
  // Modo escuro por CLASSE (.dark no <html>), nao por prefers-color-scheme:
  // o usuario escolhe o tema e a escolha sobrepoe o sistema. A recoloracao
  // vem dos tokens em globals.css (html.dark), entao nao usamos variantes
  // `dark:` espalhadas pelas telas.
  darkMode: "class",
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Marca (verde) e superficies.
        brand: {
          DEFAULT: "var(--brand)",
          dark: "var(--brand-dark)",
          light: "var(--brand-light)",
          contrast: "var(--brand-contrast)",
        },
        // Moldura institucional (sidebar, cabecalhos).
        marinho: {
          DEFAULT: "var(--marinho)",
          escuro: "var(--marinho-escuro)",
        },
        surface: {
          DEFAULT: "var(--surface)",
          muted: "var(--surface-muted)",
          border: "var(--surface-border)",
        },
        content: {
          DEFAULT: "var(--content)",
          muted: "var(--content-muted)",
          inverse: "var(--content-inverse)",
        },
        // Estados operacionais / prioridades.
        status: {
          disponivel: "var(--status-disponivel)",
          uso: "var(--status-uso)",
          manutencao: "var(--status-manutencao)",
        },
        prioridade: {
          critica: "var(--prio-critica)",
          alta: "var(--prio-alta)",
          media: "var(--prio-media)",
          baixa: "var(--prio-baixa)",
          // Versao solida (fundo do bloco de prioridade).
          "critica-solida": "var(--prio-critica-solida)",
          "alta-solida": "var(--prio-alta-solida)",
          "media-solida": "var(--prio-media-solida)",
          "baixa-solida": "var(--prio-baixa-solida)",
        },
        // Acentos dos KPIs do painel (uma cor por indicador).
        acento: {
          chamados: "var(--acento-chamados)",
          veiculos: "var(--acento-veiculos)",
          turnos: "var(--acento-turnos)",
          frota: "var(--acento-frota)",
        },
      },
      borderRadius: {
        card: "14px",
      },
      boxShadow: {
        // Sombra suave, elevacao discreta (estilo dos cards da referencia).
        card: "0 1px 2px rgba(15, 35, 51, 0.04), 0 6px 16px rgba(15, 35, 51, 0.06)",
      },
      fontFamily: {
        sans: [
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "Helvetica",
          "Arial",
          "sans-serif",
        ],
      },
    },
  },
  plugins: [],
};

export default config;
