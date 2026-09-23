"use client";

import { ReactNode } from "react";
import {
  ChevronDown,
  LifeBuoy,
  PhoneCall,
  MapPinned,
  Stethoscope,
  Route,
  BellRing,
  FileBarChart2,
  Truck,
  Settings,
} from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";

/**
 * Aba de Ajuda do sistema.
 *
 * Conteúdo estático (não depende de API): explica o fluxo geral e o que cada
 * área faz, além de um FAQ. Usa <details>/<summary> nativos — acordeão
 * acessível por teclado e leitor de tela, sem JavaScript.
 */
export default function AjudaPage() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-acento-chamados text-white">
          <LifeBuoy size={22} />
        </span>
        <div>
          <h1 className="text-2xl font-bold text-content">Ajuda</h1>
          <p className="text-sm text-content-muted">
            Como usar o Agiliza Frota — fluxo geral, o que cada tela faz e as
            dúvidas mais comuns.
          </p>
        </div>
      </div>

      {/* Primeiros passos */}
      <Card>
        <CardHeader>
          <h2 className="font-semibold text-content">Primeiros passos</h2>
        </CardHeader>
        <CardBody>
          <ol className="flex flex-col gap-3">
            <Passo n={1}>
              A <strong>Central</strong> recebe ou cadastra um{" "}
              <strong>chamado</strong> (o transporte de um paciente), com uma
              prioridade.
            </Passo>
            <Passo n={2}>
              A Central <strong>aciona</strong> uma ambulância disponível para o
              chamado.
            </Passo>
            <Passo n={3}>
              O <strong>motorista</strong>, pelo aplicativo, executa o
              atendimento marco a marco (saída, chegada, transporte, conclusão).
            </Passo>
            <Passo n={4}>
              A <strong>recepção</strong> do hospital acompanha as{" "}
              <strong>chegadas</strong> para preparar a entrada do paciente.
            </Passo>
          </ol>
        </CardBody>
      </Card>

      {/* Guia por área */}
      <Card>
        <CardHeader>
          <h2 className="font-semibold text-content">Guia por área</h2>
        </CardHeader>
        <CardBody className="flex flex-col divide-y divide-surface-border">
          <Secao icone={<PhoneCall size={18} />} titulo="Chamados">
            Onde os pedidos de transporte nascem e são acompanhados. Cada
            chamado tem uma prioridade — <strong>crítica</strong> (vermelho),{" "}
            <strong>alta</strong> (laranja), <strong>média</strong> (azul) e{" "}
            <strong>baixa</strong> — e a lista se ordena pela urgência. É aqui
            que você aciona uma viatura ou cancela um chamado.
          </Secao>
          <Secao icone={<MapPinned size={18} />} titulo="Frota">
            Situação das ambulâncias em tempo real: disponíveis, em uso e em
            manutenção, com a posição no mapa quando há turno aberto.
          </Secao>
          <Secao icone={<Stethoscope size={18} />} titulo="Atendimentos">
            Os transportes em andamento e a etapa atual de cada um.
          </Secao>
          <Secao icone={<Route size={18} />} titulo="Rotas e ETA">
            Rota da ambulância e o tempo estimado de chegada (ETA) ao destino.
          </Secao>
          <Secao icone={<BellRing size={18} />} titulo="Chegadas">
            Visão da recepção: quais ambulâncias estão chegando, para preparar a
            entrada do paciente.
          </Secao>
          <Secao icone={<FileBarChart2 size={18} />} titulo="Histórico, Relatórios e Auditoria">
            Consulta do que já aconteceu: histórico de atendimentos, relatórios
            gerenciais e a trilha de auditoria (quem fez o quê e quando).
          </Secao>
          <Secao icone={<Truck size={18} />} titulo="Cadastros (Veículos, Turnos, Unidades, Usuários)">
            Onde a operação é configurada: a frota, os turnos, os hospitais
            (unidades) e as pessoas com acesso ao sistema.
          </Secao>
          <Secao icone={<Settings size={18} />} titulo="Configurações">
            Preferências deste navegador: tema claro/escuro e os sons de alerta.
          </Secao>
        </CardBody>
      </Card>

      {/* FAQ */}
      <Card>
        <CardHeader>
          <h2 className="font-semibold text-content">Perguntas frequentes</h2>
        </CardHeader>
        <CardBody className="flex flex-col divide-y divide-surface-border">
          <Secao titulo="Não consigo excluir um veículo ou usuário. Por quê?">
            O sistema não apaga registros de operação — ele{" "}
            <strong>desativa</strong> (marca como inativo). Isso preserva o
            histórico e atende à LGPD. Um item desativado deixa de aparecer nas
            listas de seleção, mas continua nos registros passados.
          </Secao>
          <Secao titulo="Não ouço o alerta de novo chamado.">
            Verifique se os sons estão ligados em{" "}
            <strong>Configurações</strong>. Alguns navegadores também bloqueiam
            áudio até a primeira interação na página — clique em qualquer lugar e
            teste de novo.
          </Secao>
          <Secao titulo="Sou da recepção e só vejo a tela de Chegadas.">
            É o esperado. Cada perfil vê apenas o que lhe compete: a recepção
            acompanha as chegadas; a gestão da frota fica com a Central.
          </Secao>
          <Secao titulo="Como troco entre tema claro e escuro?">
            Pelo ícone de engrenagem no canto superior direito, ou na tela de{" "}
            <strong>Configurações</strong>. A escolha fica salva neste navegador.
          </Secao>
        </CardBody>
      </Card>

      <p className="text-center text-sm text-content-muted">
        Não encontrou o que precisava? Fale com o administrador do sistema da sua
        unidade.
      </p>
    </div>
  );
}

/** Passo numerado dos "primeiros passos". */
function Passo({ n, children }: { n: number; children: ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-light text-xs font-bold text-brand">
        {n}
      </span>
      <span className="text-sm text-content">{children}</span>
    </li>
  );
}

/** Item de acordeão acessível (details/summary nativo). */
function Secao({
  titulo,
  icone,
  children,
}: {
  titulo: string;
  icone?: ReactNode;
  children: ReactNode;
}) {
  return (
    <details className="group py-3 first:pt-0 last:pb-0">
      <summary className="flex cursor-pointer list-none items-center gap-2 font-medium text-content marker:hidden">
        {icone && <span className="text-content-muted">{icone}</span>}
        <span className="flex-1">{titulo}</span>
        <ChevronDown
          size={18}
          className="text-content-muted transition-transform group-open:rotate-180"
        />
      </summary>
      <p className="mt-2 pl-1 text-sm leading-relaxed text-content-muted">
        {children}
      </p>
    </details>
  );
}
