import type { Config } from "tailwindcss";

/**
 * Design system - Agiliza Frota (clinico institucional).
 * As cores usam variaveis CSS definidas em globals.css para facilitar temas.
 */
const config: Config = {
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Marca (azul institucional) e superficies.
        brand: {
          DEFAULT: "var(--brand)",
          dark: "var(--brand-dark)",
          light: "var(--brand-light)",
          contrast: "var(--brand-contrast)",
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
        },
      },
      borderRadius: {
        card: "12px",
      },
      boxShadow: {
        card: "0 1px 2px rgba(15, 23, 42, 0.06), 0 1px 3px rgba(15, 23, 42, 0.10)",
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
