"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Ambulance, BellRing, Check, CheckCheck, Radio } from "lucide-react";

import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useNotificacoesStream } from "@/lib/useNotificacoesStream";
import { tocarAlerta } from "@/lib/som";
import { Notificacao, PrioridadeChamado } from "@/types/api";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";

const TOM_PRIORIDADE: Record<string, string> = {
  critica: "text-prioridade-critica",
  alta: "text-prioridade-alta",
  media: "text-prioridade-media",
  baixa: "text-prioridade-baixa",
};

/**
 * Painel de chegadas da recepção hospitalar (RF15).
 *
 * O requisito diz "notificar a recepcionista sobre a chegada de veículo para
 * agilizar a entrada". Isso define o desenho desta tela:
 *
 *  - **A chegada é o único assunto.** Nada de menus, filtros de período ou
 *    relatórios: quem está na recepção precisa saber qual ambulância está
 *    chegando, de onde e com que gravidade — e mais nada.
 *  - **A tela é vista de longe.** O cartão da chegada mais recente ocupa a
 *    largura toda, com tipografia grande, porque o monitor da recepção fica
 *    num balcão e a pessoa costuma estar em pé, atendendo outra coisa.
 *  - **O alerta é sonoro.** Ninguém fica olhando para a tela esperando; o som
 *    é o que traz a atenção, igual ao alerta de chamado novo na Central.
 *  - **Marcar como lida é explícito.** Serve de confirmação de que alguém
 *    viu — informação que a Central pode auditar depois.
 */
export default function ChegadasPage() {
  const { perfil } = useAuth();
  const [notificacoes, setNotificacoes] = useState<Notificacao[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [somLigado, setSomLigado] = useState(true);

  const carregar = useCallback(async () => {
    try {
      const r = await api<{ notificacoes: Notificacao[] }>("/notificacoes?limite=50");
      setNotificacoes(r.notificacoes);
      setErro(null);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao carregar as chegadas.");
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const aoReceber = useCallback(
    (nova: Notificacao) => {
      setNotificacoes((atual) =>
        atual.some((n) => n.id === nova.id) ? atual : [nova, ...atual],
      );
      if (somLigado) tocarAlerta();
    },
    [somLigado],
  );

  const { conectado } = useNotificacoesStream(aoReceber);

  async function marcarLida(id: string) {
    // Atualiza a tela na hora e só então avisa o servidor: a recepcionista
    // não deve esperar a rede para confirmar que viu.
    setNotificacoes((atual) =>
      atual.map((n) => (n.id === id ? { ...n, lida: true } : n)),
    );
    try {
      await api(`/notificacoes/${id}/lida`, { method: "PATCH" });
    } catch {
      void carregar();
    }
  }

  async function marcarTodas() {
    setNotificacoes((atual) => atual.map((n) => ({ ...n, lida: true })));
    try {
      await api("/notificacoes/lidas", { method: "PATCH" });
    } catch {
      void carregar();
    }
  }

  const naoLidas = useMemo(
    () => notificacoes.filter((n) => !n.lida),
    [notificacoes],
  );
  const lidas = useMemo(() => notificacoes.filter((n) => n.lida), [notificacoes]);
  const emDestaque = naoLidas[0];

  if (carregando) {
    return (
      <div className="grid h-64 place-items-center">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-content">Chegadas</h1>
          <p className="text-sm text-content-muted">
            {perfil?.unidade_id
              ? "Ambulâncias a caminho da sua unidade."
              : "Ambulâncias chegando às unidades."}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span
            className={[
              "flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold",
              conectado
                ? "bg-status-disponivel/10 text-status-disponivel"
                : "bg-surface-muted text-content-muted",
            ].join(" ")}
          >
            <Radio size={14} />
            {conectado ? "Ao vivo" : "Reconectando"}
          </span>
          <button
            onClick={() => setSomLigado((s) => !s)}
            className="rounded-lg border border-surface-border px-3 py-1.5 text-xs font-medium text-content-muted hover:bg-surface-muted"
            title="O alerta sonoro avisa mesmo quando ninguém está olhando a tela"
          >
            Som: {somLigado ? "ligado" : "desligado"}
          </button>
          {naoLidas.length > 0 && (
            <Button variante="secundario" onClick={() => void marcarTodas()}>
              <CheckCheck size={16} /> Marcar todas
            </Button>
          )}
        </div>
      </div>

      {erro && (
        <Card>
          <CardBody>
            <p className="text-sm text-prioridade-critica">{erro}</p>
          </CardBody>
        </Card>
      )}

      {/* Chegada mais recente, em destaque */}
      {emDestaque ? (
        <ChegadaEmDestaque
          notificacao={emDestaque}
          aoConfirmar={() => void marcarLida(emDestaque.id)}
        />
      ) : (
        <Card>
          <CardBody>
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <Ambulance size={48} className="text-content-muted" />
              <p className="text-lg font-semibold text-content">
                Nenhuma chegada pendente
              </p>
              <p className="max-w-md text-sm text-content-muted">
                Você será avisada automaticamente, com alerta sonoro, quando uma
                ambulância se aproximar da unidade.
              </p>
            </div>
          </CardBody>
        </Card>
      )}

      {/* Demais pendentes */}
      {naoLidas.length > 1 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-content-muted">
            Também a caminho ({naoLidas.length - 1})
          </h2>
          {naoLidas.slice(1).map((n) => (
            <LinhaChegada
              key={n.id}
              notificacao={n}
              aoConfirmar={() => void marcarLida(n.id)}
            />
          ))}
        </section>
      )}

      {/* Histórico do dia */}
      {lidas.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-content-muted">
            Já confirmadas ({lidas.length})
          </h2>
          {lidas.slice(0, 20).map((n) => (
            <LinhaChegada key={n.id} notificacao={n} />
          ))}
        </section>
      )}
    </div>
  );
}

/** Cartão grande da chegada mais recente — pensado para ser visto de longe. */
function ChegadaEmDestaque({
  notificacao,
  aoConfirmar,
}: {
  notificacao: Notificacao;
  aoConfirmar: () => void;
}) {
  const d = notificacao.dados ?? {};
  const critica = d.prioridade === "critica" || d.prioridade === "alta";

  return (
    <div
      className={[
        "rounded-card border-2 bg-surface p-6",
        critica ? "border-prioridade-critica" : "border-brand",
      ].join(" ")}
    >
      <div className="flex items-center gap-2">
        <BellRing
          size={18}
          className={critica ? "text-prioridade-critica" : "text-brand"}
        />
        <span
          className={[
            "text-xs font-bold uppercase tracking-wider",
            critica ? "text-prioridade-critica" : "text-brand",
          ].join(" ")}
        >
          Ambulância chegando
        </span>
        <span className="ml-auto text-sm text-content-muted">
          {horaDe(notificacao.criado_em)}
        </span>
      </div>

      <p className="mt-3 text-4xl font-extrabold tracking-tight text-content">
        {d.placa ?? "Veículo"}
      </p>

      {d.natureza && (
        <p
          className={[
            "mt-1 text-xl font-semibold",
            TOM_PRIORIDADE[d.prioridade ?? "baixa"] ?? "text-content",
          ].join(" ")}
        >
          {d.natureza}
          {d.prioridade && (
            <span className="ml-2 text-sm font-bold uppercase">
              · {d.prioridade}
            </span>
          )}
        </p>
      )}

      <dl className="mt-4 grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
        {d.motorista && (
          <div className="flex gap-2">
            <dt className="text-content-muted">Motorista:</dt>
            <dd className="font-medium text-content">{d.motorista}</dd>
          </div>
        )}
        {d.unidade && (
          <div className="flex gap-2">
            <dt className="text-content-muted">Destino:</dt>
            <dd className="font-medium text-content">{d.unidade}</dd>
          </div>
        )}
        {d.distancia_m !== null && d.distancia_m !== undefined && (
          <div className="flex gap-2">
            <dt className="text-content-muted">Distância na detecção:</dt>
            <dd className="font-medium text-content">{d.distancia_m} m</dd>
          </div>
        )}
      </dl>

      <Button className="mt-5 w-full sm:w-auto" onClick={aoConfirmar}>
        <Check size={18} /> Confirmar que vi
      </Button>
    </div>
  );
}

/** Linha compacta para as demais chegadas. */
function LinhaChegada({
  notificacao,
  aoConfirmar,
}: {
  notificacao: Notificacao;
  aoConfirmar?: () => void;
}) {
  const d = notificacao.dados ?? {};

  return (
    <div
      className={[
        "flex flex-wrap items-center gap-3 rounded-card border bg-surface px-4 py-3",
        notificacao.lida ? "border-surface-border opacity-70" : "border-brand/40",
      ].join(" ")}
    >
      <Ambulance
        size={20}
        className={notificacao.lida ? "text-content-muted" : "text-brand"}
      />
      <span className="font-bold text-content">{d.placa ?? "Veículo"}</span>
      {d.natureza && (
        <span
          className={[
            "text-sm",
            TOM_PRIORIDADE[d.prioridade ?? "baixa"] ?? "text-content-muted",
          ].join(" ")}
        >
          {d.natureza}
        </span>
      )}
      <span className="ml-auto text-xs text-content-muted">
        {horaDe(notificacao.criado_em)}
      </span>
      {aoConfirmar && (
        <button
          onClick={aoConfirmar}
          className="rounded-lg border border-surface-border px-3 py-1.5 text-xs font-medium text-brand hover:bg-brand-light"
        >
          Confirmar
        </button>
      )}
    </div>
  );
}

/** Só a hora: a recepção lida com o agora, não com datas. */
function horaDe(valor: string): string {
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return "—";
  const hoje = new Date();
  const mesmoDia = data.toDateString() === hoje.toDateString();
  return mesmoDia
    ? data.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
    : data.toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
}
