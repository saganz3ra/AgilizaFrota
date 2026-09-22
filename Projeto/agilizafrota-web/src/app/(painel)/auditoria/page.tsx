"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Eye, Search } from "lucide-react";

import { api, ApiError } from "@/lib/api";
import { AuditoriaResposta, RegistroAuditoria, Usuario } from "@/types/api";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { Spinner } from "@/components/ui/Spinner";
import { Modal } from "@/components/ui/Modal";
import { mascaraData } from "@/lib/mascaras";
import { dataParaIso, validarIntervalo } from "@/lib/validacao";

/**
 * Consulta dos logs de auditoria (RF14). Só leitura, só central.
 *
 * O log é append-only por decisão de projeto: não existe endpoint de edição
 * nem de exclusão — poder alterar o rastro derrotaria o propósito da auditoria.
 * Por isso esta tela não tem nenhuma ação de escrita; é uma ferramenta de
 * fiscalização. O `dados_antes`/`dados_depois` de cada registro fica no modal
 * de detalhe, que é onde a auditoria de fato "conta o que mudou".
 */

const LIMITE = 100;

export default function AuditoriaPage() {
  const [usuarioId, setUsuarioId] = useState("");
  const [entidade, setEntidade] = useState("");
  const [acao, setAcao] = useState("");
  const [sucesso, setSucesso] = useState("");
  const [desde, setDesde] = useState("");
  const [ate, setAte] = useState("");

  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [registros, setRegistros] = useState<RegistroAuditoria[]>([]);
  const [offset, setOffset] = useState(0);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [detalhe, setDetalhe] = useState<RegistroAuditoria | null>(null);

  useEffect(() => {
    let ativo = true;
    (async () => {
      try {
        const { usuarios } = await api<{ usuarios: Usuario[] }>("/usuarios");
        if (ativo) setUsuarios(usuarios);
      } catch {
        /* filtro por usuário indisponível; não bloqueia a consulta */
      }
    })();
    return () => {
      ativo = false;
    };
  }, []);

  const montarQuery = useCallback(
    (deslocamento: number): string => {
      const p = new URLSearchParams();
      if (usuarioId) p.set("usuario_id", usuarioId);
      if (entidade.trim()) p.set("entidade", entidade.trim());
      if (acao.trim()) p.set("acao", acao.trim());
      if (sucesso) p.set("sucesso", sucesso);
      const isoDesde = dataParaIso(desde);
      const isoAte = dataParaIso(ate, { fimDoDia: true });
      if (isoDesde) p.set("desde", isoDesde);
      if (isoAte) p.set("ate", isoAte);
      p.set("limite", String(LIMITE));
      p.set("offset", String(deslocamento));
      return `?${p.toString()}`;
    },
    [usuarioId, entidade, acao, sucesso, desde, ate],
  );

  const carregar = useCallback(
    async (deslocamento: number) => {
      const erroData = validarIntervalo(desde, ate);
      if (erroData) {
        setErro(erroData);
        return;
      }
      setErro(null);
      setCarregando(true);
      try {
        const resp = await api<AuditoriaResposta>(`/auditoria${montarQuery(deslocamento)}`);
        setRegistros(resp.registros);
        setOffset(deslocamento);
      } catch (e) {
        setRegistros([]);
        setErro(mensagemErro(e));
      } finally {
        setCarregando(false);
      }
    },
    [desde, ate, montarQuery],
  );

  useEffect(() => {
    void carregar(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const temProxima = registros.length === LIMITE;
  const temAnterior = offset > 0;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-content">Auditoria</h1>
        <p className="text-sm text-content-muted">
          Registro de todas as ações no sistema — quem fez, o quê e quando. Somente leitura.
        </p>
      </div>

      <Card>
        <CardBody className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Select
              label="Usuário"
              value={usuarioId}
              onChange={(e) => setUsuarioId(e.target.value)}
              opcoes={[
                { valor: "", rotulo: "Todos os usuários" },
                ...usuarios.map((u) => ({ valor: u.id, rotulo: `${u.nome} (${u.papel})` })),
              ]}
            />
            <Input
              label="Entidade"
              placeholder="ex.: veiculo, turno, chamado"
              value={entidade}
              onChange={(e) => setEntidade(e.target.value)}
            />
            <Input
              label="Ação"
              placeholder="ex.: criar, atualizar, validar"
              value={acao}
              onChange={(e) => setAcao(e.target.value)}
            />
            <Select
              label="Resultado"
              value={sucesso}
              onChange={(e) => setSucesso(e.target.value)}
              opcoes={[
                { valor: "", rotulo: "Todos os resultados" },
                { valor: "true", rotulo: "Sucesso" },
                { valor: "false", rotulo: "Negada / falha" },
              ]}
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
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={() => void carregar(0)} carregando={carregando}>
              <Search size={16} /> Buscar
            </Button>
            <Button
              variante="ghost"
              onClick={() => {
                setUsuarioId("");
                setEntidade("");
                setAcao("");
                setSucesso("");
                setDesde("");
                setAte("");
              }}
              disabled={carregando}
            >
              Limpar filtros
            </Button>
          </div>
        </CardBody>
      </Card>

      {erro && (
        <Card>
          <CardBody>
            <p className="text-sm text-prioridade-critica">{erro}</p>
          </CardBody>
        </Card>
      )}

      {carregando ? (
        <div className="grid h-64 place-items-center">
          <Spinner />
        </div>
      ) : registros.length === 0 ? (
        <Card>
          <CardBody>
            <p className="py-6 text-center text-sm text-content-muted">
              Nenhum registro de auditoria para os filtros selecionados.
            </p>
          </CardBody>
        </Card>
      ) : (
        <>
          <div className="overflow-x-auto rounded-card border border-surface-border bg-surface">
            <table className="w-full text-sm">
              <thead className="border-b border-surface-border text-left text-content-muted">
                <tr>
                  <th className="whitespace-nowrap px-4 py-3 font-medium">Quando</th>
                  <th className="px-4 py-3 font-medium">Usuário</th>
                  <th className="px-4 py-3 font-medium">Ação</th>
                  <th className="px-4 py-3 font-medium">Entidade</th>
                  <th className="px-4 py-3 font-medium">Requisição</th>
                  <th className="px-4 py-3 font-medium">Resultado</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {registros.map((r) => (
                  <tr key={r.id} className="border-b border-surface-border last:border-0">
                    <td className="whitespace-nowrap px-4 py-3 text-content-muted">
                      {formatarData(r.criado_em)}
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-content">{r.usuario_email ?? "—"}</p>
                      {r.papel && <p className="text-xs text-content-muted">{r.papel}</p>}
                    </td>
                    <td className="px-4 py-3 text-content">{r.acao}</td>
                    <td className="px-4 py-3 text-content-muted">
                      {r.entidade ?? "—"}
                      {r.entidade_id && (
                        <span className="block text-xs">{r.entidade_id.slice(0, 8)}…</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-content-muted">
                      {r.metodo} {r.rota}
                    </td>
                    <td className="px-4 py-3">
                      <Badge tom={r.sucesso ? "disponivel" : "critica"}>
                        {r.status_http ?? "—"} {r.sucesso ? "OK" : "Falha"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button variante="ghost" tamanho="sm" onClick={() => setDetalhe(r)}>
                        <Eye size={16} /> Ver
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm text-content-muted">
              Mostrando {registros.length} registro(s) a partir do #{offset + 1}
            </span>
            <div className="flex gap-2">
              <Button
                variante="secundario"
                tamanho="sm"
                onClick={() => void carregar(Math.max(0, offset - LIMITE))}
                disabled={!temAnterior || carregando}
              >
                <ChevronLeft size={16} /> Anterior
              </Button>
              <Button
                variante="secundario"
                tamanho="sm"
                onClick={() => void carregar(offset + LIMITE)}
                disabled={!temProxima || carregando}
              >
                Próxima <ChevronRight size={16} />
              </Button>
            </div>
          </div>
        </>
      )}

      <Modal
        aberto={detalhe !== null}
        aoFechar={() => setDetalhe(null)}
        titulo="Detalhe do registro"
      >
        {detalhe && <DetalheAuditoria registro={detalhe} />}
      </Modal>
    </div>
  );
}

function DetalheAuditoria({ registro }: { registro: RegistroAuditoria }) {
  return (
    <div className="space-y-3 text-sm">
      <Linha rotulo="Quando" valor={formatarData(registro.criado_em)} />
      <Linha rotulo="Usuário" valor={`${registro.usuario_email ?? "—"} (${registro.papel ?? "—"})`} />
      <Linha rotulo="Ação" valor={registro.acao} />
      <Linha
        rotulo="Entidade"
        valor={`${registro.entidade ?? "—"}${registro.entidade_id ? ` · ${registro.entidade_id}` : ""}`}
      />
      <Linha rotulo="Requisição" valor={`${registro.metodo ?? "—"} ${registro.rota ?? ""}`.trim()} />
      <Linha
        rotulo="Resultado"
        valor={`${registro.status_http ?? "—"} · ${registro.sucesso ? "sucesso" : "falha/negada"}`}
      />
      <Linha rotulo="Origem" valor={`${registro.ip ?? "—"}${registro.duracao_ms != null ? ` · ${registro.duracao_ms} ms` : ""}`} />
      {registro.user_agent && <Linha rotulo="Agente" valor={registro.user_agent} />}

      <div>
        <p className="mb-1 font-medium text-content">Antes</p>
        <Json valor={registro.dados_antes} />
      </div>
      <div>
        <p className="mb-1 font-medium text-content">Depois</p>
        <Json valor={registro.dados_depois} />
      </div>
    </div>
  );
}

function Linha({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="flex gap-2">
      <span className="w-24 shrink-0 text-content-muted">{rotulo}</span>
      <span className="break-all text-content">{valor}</span>
    </div>
  );
}

/** Mostra o JSONB do log de forma legível; travessão quando vazio. */
function Json({ valor }: { valor: unknown }) {
  if (valor === null || valor === undefined) {
    return <p className="text-content-muted">—</p>;
  }
  return (
    <pre className="max-h-48 overflow-auto rounded-lg bg-surface-muted p-3 text-xs text-content">
      {JSON.stringify(valor, null, 2)}
    </pre>
  );
}

/** Traduz o erro em mensagem para o operador, reagindo ao `codigo` da API. */
function mensagemErro(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.codigo === "ACESSO_NEGADO") return "Apenas o perfil da Central pode ver a auditoria.";
    return e.message;
  }
  return "Não foi possível conectar à API. Verifique se o backend está no ar.";
}

function formatarData(valor: string): string {
  const d = new Date(valor);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString("pt-BR");
}
