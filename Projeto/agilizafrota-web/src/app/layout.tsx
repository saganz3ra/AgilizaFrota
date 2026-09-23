import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";

export const metadata: Metadata = {
  title: "Agiliza Frota - Central",
  description: "Painel da Central de gestao de frota hospitalar.",
};

/**
 * Script anti-flash (FOUC). Roda ANTES da primeira pintura, ainda no <head>,
 * porque o servidor nao sabe as preferencias do usuario: sem isso, a pagina
 * apareceria no padrao por um instante e so mudaria depois que o React
 * hidratasse. Aplica tema (classe .dark) e aparencia (fonte, densidade,
 * animacoes) a partir do localStorage.
 *
 * Fica como string inline (dangerouslySetInnerHTML) de proposito: precisa
 * executar de forma sincrona antes do corpo renderizar; um componente React
 * so rodaria depois da hidratacao, tarde demais para evitar o flash.
 */
const scriptPreferencias = `
  (function () {
    try {
      var d = document.documentElement;
      var tema = localStorage.getItem('tema');
      var escuro = tema ? tema === 'escuro'
        : window.matchMedia('(prefers-color-scheme: dark)').matches;
      d.classList.toggle('dark', escuro);

      var fonte = localStorage.getItem('fonte');
      if (fonte) d.setAttribute('data-fonte', fonte);
      var dens = localStorage.getItem('densidade');
      if (dens) d.setAttribute('data-densidade', dens);
      var anim = localStorage.getItem('animacoes');
      if (anim) d.setAttribute('data-animacoes', anim);
    } catch (e) {
      /* localStorage bloqueado (aba anonima, etc.): segue nos padroes. */
    }
  })();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // suppressHydrationWarning: o script acima muda a classe do <html> antes da
  // hidratacao, entao o HTML do cliente diverge do servidor de proposito -
  // sem isso o React reclamaria dessa diferenca esperada.
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: scriptPreferencias }} />
      </head>
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
