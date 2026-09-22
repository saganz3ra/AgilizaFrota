"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, FileText, RefreshCw } from "lucide-react";

import { api, ApiError, apiUrl } from "@/lib/api";
import { auth } from "@/lib/firebase";
import {
  RelatorioResposta,
  StatusAtendimento,
  TipoRelatorio,
  Unidade,
} from "@/types/api";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Input } from "@/components/ui/Input";
import { Spinner } from "@/components/ui/Spinner";
import { mascaraData } from "@/lib/mascaras";
import { dataParaIso, validarIntervalo } from "@/lib/validacao";

/**
 * Geração e exportação de relatórios (RF13).
 *
 * A tela é o consumidor que faltava para `GET /relatorios/:tipo`. É restrita à
 * Central — as rotas exigem o papel `central` (autorizarPapel), então a
 * recepção nunca chega aqui (o layout a redireciona) e o motorista receberia
 * 403. Esse 403 é tratado como mensagem, não como quebra de tela.
 *
 * Decisão de projeto: a **prévia** é renderizada de forma genérica a partir de
 * `colunas` e `linhas` que o próprio backend devolve. A tela não conhece os
 * campos de cada relatório de antemão — quem define o formato é o servidor, um
 * lugar só. Assim, mudar uma coluna no backend não exige mexer aqui.
 *
 * Exportação: CSV e HTML **não** passam pelo wrapper `api()` (que desserializa
 * JSON). São baixados como arquivo, com o token do Firebase no cabeçalho —
 * por isso não dá para simplesmente abrir a URL numa aba nova, que não levaria
 * o `Authorization`.
 */

const TIPOS: { valor: TipoRelatorio; rotulo: string }[] = [
  { valor: "operacional", rotulo: "Operacional (atendimentos)" },
  { valor: "frota", rotulo: "Uso da frota" },
  { valor: "desempenho", rotulo: "Desempenho por motorista" },
];

const STATUS_ATENDIMENTO: { valor: StatusAtendimento; rotulo: string }[] = [
  { valor: "a_caminho", rotulo: "A caminho" },
  { valor: "no_local", rotulo: "No local" },
  { valor: "em_transporte", rotulo: "Em transporte" },
  { valor: "concluido", rotulo: "Concluído" },
  { valor: "cancelado", rotulo: "Cancelado" },
];

export default function RelatoriosPage() {
  const [tipo, setTipo] = useState<TipoRelatorio>("operacional");
  const [desde, setDesde] = useState("");
  const [ate, setAte] = useState("");
  const [unidadeId, setUnidadeId] = useState("");
  const [status, setStatus] = useState("");

  const [unidades, setUnidades] = useState<Unidade[]>([]);
  const [dados, setDados] = useState<RelatorioResposta | null>(null);
  const [carregandoPrevia, setCarregandoPrevia] = useState(false);
  const [exportando, setExportando] = useState<"csv" | "html" | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  // Só o relatório operacional usa os filtros de unidade e status.
  const filtrosOperacional = tipo === "operacional";

  // Unidades para o filtro. Falha silenciosa: se não vierem, o relatório ainda
  // pode ser gerado — apenas sem restringir por unidade.
  useEffect(() => {
    let ativo = true;
    (async () => {
      try {
        const { unidades } = await api<{ unidades: Unidade[] }>("/unidades");
        if (ativo) setUnidades(unidades.filter((u) => u.ativo));
      } catch {
        /* filtro de unidade fica indisponível; não é bloqueante */
      }
    })();
    return () => {
      ativo = false;
    };
  }, []);

  /**
   * Monta a query string a partir dos filtros. As datas digitadas (DD/MM/AAAA)
   * viram ISO 8601 com offset (o backend valida com Zod `.datetime({offset})`):
   * "desde" no início do dia e "ate" no fim, para o intervalo incluir o dia
   * inteiro. `dataParaIso` devolve null para data vazia/inválida — que aqui
   * simplesmente não entra no filtro (a validação já barrou antes do envio).
   */
  const montarQuery = (formato?: "csv" | "html"): string => {
    const p = new URLSearchParams();
    const isoDesde = dataParaIso(desde);
    const isoAte = dataParaIso(ate, { fimDoDia: true });
    if (isoDesde) p.set("desde", isoDesde);
    if (isoAte) p.set("ate", isoAte);
    if (filtrosOperacional) {
      if (unidadeId) p.set("unidade_id", unidadeId);
      if (status) p.set("status", status);
    }
    if (formato) p.set("formato", formato);
    const qs = p.toString();
    return qs ? `?${qs}` : "";
  };

  /** Valida as datas (formato e intervalo) antes de qualquer chamada. */
  const validarPeriodo = (): string | null => validarIntervalo(desde, ate);

  const gerarPrevia = async () => {
    const invalido = validarPeriodo();
    if (invalido) {
      setErro(invalido);
      return;
    }
    setErro(null);
    setCarregandoPrevia(true);
    try {
      const resp = await api<RelatorioResposta>(`/relatorios/${tipo}${montarQuery()}`);
      setDados(resp);
    } catch (e) {
      setDados(null);
      setErro(mensagemErro(e));
    } finally {
      setCarregandoPrevia(false);
    }
  };

  const baixar = async (formato: "csv" | "html") => {
    const invalido = validarPeriodo();
    if (invalido) {
      setErro(invalido);
      return;
    }
    setErro(null);
    setExportando(formato);
    let url: string | null = null;
    try {
      const token = await auth.currentUser?.getIdToken();
      const resp = await fetch(apiUrl(`/relatorios/${tipo}${montarQuery(formato)}`), {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (!resp.ok) {
        // Em erro, o backend responde JSON { erro, codigo } — não o arquivo.
        let msg = `Erro ${resp.status}`;
        let codigo: string | undefined;
        try {
          const corpo = (await resp.json()) as { erro?: string; codigo?: string };
          msg = corpo.erro || msg;
          codigo = corpo.codigo;
        } catch {
          /* corpo não-JSON: mantém a mensagem genérica */
        }
        throw new ApiError(resp.status, msg, codigo);
      }

      const blob = await resp.blob();
      url = URL.createObjectURL(blob);

      if (formato === "html") {
        // HTML pronto para impressão → o usuário faz Ctrl/Cmd+P e "Salvar como PDF".
        const janela = window.open(url, "_blank");
        if (!janela) {
          setErro(
            "O navegador bloqueou a abertura da aba. Permita pop-ups deste site para abrir o relatório em PDF.",
          );
        }
        // Revoga só depois, senão a aba nova perde a fonte antes de carregar.
        window.setTimeout(() => url && URL.revokeObjectURL(url), 60_000);
        url = null; // já agendada a revogação
      } else {
        const a = document.createElement("a");
        a.href = url;
        a.download = `relatorio-${tipo}.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
      }
    } catch (e) {
      setErro(mensagemErro(e));
    } finally {
      if (url) URL.revokeObjectURL(url);
      setExportando(null);
    }
  };

  const ocupado = carregandoPrevia || exportando !== null;

  const opcoesUnidade = useMemo(
    () => [
      { valor: "", rotulo: "Todas as unidades" },
      ...unidades.map((u) => ({ valor: u.id, rotulo: u.nome })),
    ],
    [unidades],
  );

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-content">Relatórios</h1>
        <p className="text-sm text-content-muted">
          Gere a prévia e exporte em CSV (Excel) ou PDF (via impressão do navegador).
        </p>
      </div>

      <Card>
        <CardBody className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Select
              label="Relatório"
              value={tipo}
              onChange={(e) => {
                setTipo(e.target.value as TipoRelatorio);
                setDados(null); // a prévia atual não corresponde mais ao tipo
              }}
              opcoes={TIPOS.map((t) => ({ valor: t.valor, rotulo: t.rotulo }))}
            />
            <Input
              label="De"
              value={desde}
              inputMode="numeric"
              placeholder="DD/MM/AAAA"
              onChange={(e) => setDesde(mascaraData(e.target.value))}
            />
            <Input
              label="Até"
              value={ate}
              inputMode="numeric"
              placeholder="DD/MM/AAAA"
              onChange={(e) => setAte(mascaraData(e.target.value))}
            />
            {filtrosOperacional && (
              <>
                <Select
                  label="Unidade de destino"
                  value={unidadeId}
                  onChange={(e) => setUnidadeId(e.target.value)}
                  opcoes={opcoesUnidade}
                />
                <Select
                  label="Situação do atendimento"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  opcoes={[
                    { valor: "", rotulo: "Todas as situações" },
                    ...STATUS_ATENDIMENTO.map((s) => ({ valor: s.valor, rotulo: s.rotulo })),
                  ]}
                />
              </>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={() => void gerarPrevia()} carregando={carregandoPrevia} disabled={ocupado}>
              <RefreshCw size={16} /> Gerar prévia
            </Button>
            <Button
              variante="secundario"
              onClick={() => void baixar("csv")}
              carregando={exportando === "csv"}
              disabled={ocupado}
            >
              <Download size={16} /> Exportar CSV
            </Button>
            <Button
              variante="secundario"
              onClick={() => void baixar("html")}
              carregando={exportando === "html"}
              disabled={ocupado}
            >
              <FileText size={16} /> Exportar PDF
            </Button>
          </div>

          <p className="text-xs text-content-muted">
            Sem período informado, o relatório cobre todo o histórico. O CSV usa
            separador &quot;;&quot; e abre direto no Excel; o PDF é gerado pela opção
            &quot;Salvar como PDF&quot; da janela de impressão.
          </p>
        </CardBody>
      </Card>

      {erro && (
        <Card>
          <CardBody>
            <p className="text-sm text-prioridade-critica">{erro}</p>
          </CardBody>
        </Card>
      )}

      {carregandoPrevia ? (
        <div className="grid h-64 place-items-center">
          <Spinner />
        </div>
      ) : !dados ? (
        <Card>
          <CardBody>
            <p className="py-6 text-center text-sm text-content-muted">
              Escolha o relatório e o período e clique em <strong>Gerar prévia</strong>.
            </p>
          </CardBody>
        </Card>
      ) : (
        <PreviaRelatorio dados={dados} />
      )}
    </div>
  );
}

/** Renderiza a prévia de forma genérica: cartões de resumo + tabela. */
function PreviaRelatorio({ dados }: { dados: RelatorioResposta }) {
  const resumo = Object.entries(dados.resumo ?? {});

  return (
    <div className="space-y-4">
      {resumo.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {resumo.map(([chave, valor]) => (
            <Card key={chave} className="min-w-[140px] flex-1">
              <CardBody className="py-3">
                <p className="text-xl font-bold text-content">{formatarCelula(valor)}</p>
                <p className="text-xs capitalize text-content-muted">{chave.replace(/_/g, " ")}</p>
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      <p className="text-sm text-content-muted">
        {dados.total} registro(s)
        {periodoTexto(dados.periodo)}.
      </p>

      {dados.linhas.length === 0 ? (
        <Card>
          <CardBody>
            <p className="py-6 text-center text-sm text-content-muted">
              Sem registros no período selecionado.
            </p>
          </CardBody>
        </Card>
      ) : (
        <div className="overflow-x-auto rounded-card border border-surface-border bg-surface">
          <table className="w-full text-sm">
            <thead className="border-b border-surface-border text-left text-content-muted">
              <tr>
                {dados.colunas.map((c) => (
                  <th key={c.campo} className="whitespace-nowrap px-4 py-3 font-medium">
                    {c.titulo}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {dados.linhas.map((linha, i) => (
                <tr key={i} className="border-b border-surface-border last:border-0">
                  {dados.colunas.map((c) => (
                    <td key={c.campo} className="whitespace-nowrap px-4 py-3 text-content">
                      {formatarCelula(linha[c.campo])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/** Traduz o erro em mensagem para o operador, reagindo ao `codigo` da API. */
function mensagemErro(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.codigo === "ACESSO_NEGADO") {
      return "Apenas o perfil da Central pode gerar relatórios.";
    }
    return e.message;
  }
  // fetch() falha (rede/CORS) sem passar pelo wrapper api().
  return "Não foi possível conectar à API. Verifique se o backend está no ar.";
}

/** Formata uma célula da tabela; vazios viram travessão, números no padrão pt-BR. */
function formatarCelula(valor: string | number | boolean | null | undefined): string {
  if (valor === null || valor === undefined || valor === "") return "—";
  if (typeof valor === "number") return valor.toLocaleString("pt-BR");
  if (typeof valor === "boolean") return valor ? "Sim" : "Não";
  return valor;
}

/** Texto do intervalo para a linha de resumo. */
function periodoTexto(periodo: RelatorioResposta["periodo"]): string {
  const fmt = (d?: string | null) => (d ? new Date(d).toLocaleDateString("pt-BR") : null);
  const de = fmt(periodo?.desde);
  const ate = fmt(periodo?.ate);
  if (!de && !ate) return " · todo o histórico";
  return ` · de ${de ?? "início"} até ${ate ?? "agora"}`;
}
