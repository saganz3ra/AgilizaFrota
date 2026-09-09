/**
 * Sincronizacao do app em modo offline (RNF03 - conclusao).
 *
 * Nas sprints anteriores cada recurso ganhou idempotencia individual (id
 * gerado no cliente, horario do evento separado do horario do servidor).
 * Falta va o "fecho": um PACOTE unico que o app envia ao recuperar a rede,
 * processando os itens NA ORDEM em que aconteceram e devolvendo o resultado
 * item a item - para o app saber exatamente o que ja pode limpar da fila
 * local e o que precisa reenviar ou corrigir.
 *
 * Principios:
 *  - Cada item e processado isoladamente: um item invalido NAO impede os
 *    demais (a fila do motorista nunca trava por causa de um registro ruim).
 *  - Reenviar o mesmo pacote e seguro: itens ja aplicados voltam como
 *    "duplicado", nao geram erro nem duplicam dados.
 *  - A ordem cronologica e respeitada, pois os marcos dependem dela.
 */
const { query } = require('../config/db');
const { asyncHandler } = require('../utils/asyncHandler');

const TIPOS = ['turno_iniciar', 'turno_encerrar', 'atendimento_iniciar', 'atendimento_marco', 'posicao'];

/** Executa um handler de controller "por dentro", capturando o resultado. */
function executar(handler, req) {
  return new Promise((resolve) => {
    const res = {
      statusCode: 200,
      headers: {},
      setHeader(k, v) { this.headers[k] = v; },
      status(c) { this.statusCode = c; return this; },
      json(corpo) { resolve({ status: this.statusCode, corpo }); },
      send(corpo) { resolve({ status: this.statusCode, corpo }); },
    };
    const next = (err) =>
      resolve({
        status: (err && err.statusCode) || 500,
        erro: (err && err.message) || 'Erro inesperado',
        codigo: (err && err.codigo) || 'ERRO',
      });
    Promise.resolve(handler(req, res, next)).catch((err) =>
      resolve({ status: 500, erro: err.message, codigo: 'ERRO' }),
    );
  });
}

// Carregado aqui dentro para evitar dependencia circular entre controllers.
function controllers() {
  return {
    turno: require('./turnoController'),
    atendimento: require('./atendimentoController'),
    posicao: require('./posicaoController'),
  };
}

/** Ordena os itens pelo horario do evento (o que o app registrou primeiro). */
function ordenarPorEvento(itens) {
  return [...itens].sort((a, b) => {
    const ta = new Date(a.ocorrido_em || 0).getTime();
    const tb = new Date(b.ocorrido_em || 0).getTime();
    return ta - tb;
  });
}

// POST /api/sync - envia o pacote acumulado offline.
const sincronizar = asyncHandler(async (req, res) => {
  const { turno, atendimento, posicao } = controllers();
  const itens = ordenarPorEvento(req.body.itens);

  const resultados = [];
  const resumo = { recebidos: itens.length, aplicados: 0, duplicados: 0, falhas: 0 };

  for (const item of itens) {
    const requisicao = { usuario: req.usuario, body: item.dados || {}, params: item.params || {}, query: {} };
    let r;

    switch (item.tipo) {
      case 'turno_iniciar':
        r = await executar(turno.iniciar, requisicao);
        break;
      case 'turno_encerrar':
        r = await executar(turno.encerrar, requisicao);
        break;
      case 'atendimento_iniciar':
        r = await executar(atendimento.iniciar, requisicao);
        break;
      case 'atendimento_marco': {
        const marcos = {
          chegada_local: atendimento.chegadaLocal,
          inicio_transporte: atendimento.iniciarTransporte,
          concluir: atendimento.concluir,
          cancelar: atendimento.cancelar,
        };
        const handler = marcos[item.marco];
        r = handler
          ? await executar(handler, requisicao)
          : { status: 400, erro: `Marco desconhecido: ${item.marco}`, codigo: 'MARCO_INVALIDO' };
        break;
      }
      case 'posicao':
        r = await executar(posicao.enviar, requisicao);
        break;
      default:
        r = { status: 400, erro: `Tipo desconhecido: ${item.tipo}`, codigo: 'TIPO_INVALIDO' };
    }

    const duplicado =
      r.status === 200 && r.corpo && (r.corpo.idempotente === true || r.corpo.duplicada === true);
    const ok = r.status >= 200 && r.status < 300;

    if (duplicado) resumo.duplicados += 1;
    else if (ok) resumo.aplicados += 1;
    else resumo.falhas += 1;

    resultados.push({
      id_local: item.id_local || null,
      tipo: item.tipo,
      status: r.status,
      resultado: duplicado ? 'duplicado' : ok ? 'aplicado' : 'falha',
      // Em caso de falha, o app mostra o motivo ao motorista e decide reenviar.
      erro: ok ? undefined : r.erro,
      codigo: ok ? undefined : r.codigo,
    });
  }

  res.status(200).json({
    resumo,
    resultados,
    // Itens com "falha" continuam na fila local; os demais podem ser limpos.
    orientacao:
      'Remova da fila local os itens com resultado "aplicado" ou "duplicado". ' +
      'Reenvie apenas os marcados como "falha", apos corrigir o motivo.',
  });
});

// GET /api/sync/estado - o que mudou desde um instante (o app baixa o delta).
const estado = asyncHandler(async (req, res) => {
  const desde = req.query.desde || new Date(Date.now() - 86400000).toISOString();
  const motoristaId = req.usuario.papel === 'motorista' ? req.usuario.id : null;

  const [turnos, atendimentos, chamados, notificacoes] = await Promise.all([
    query(
      `SELECT id, veiculo_id, status, atualizado_em FROM turnos
        WHERE atualizado_em >= $1 ${motoristaId ? 'AND motorista_id = $2' : ''}
        ORDER BY atualizado_em DESC LIMIT 200`,
      motoristaId ? [desde, motoristaId] : [desde],
    ),
    query(
      `SELECT id, chamado_id, status, atualizado_em FROM atendimentos
        WHERE atualizado_em >= $1 ${motoristaId ? 'AND motorista_id = $2' : ''}
        ORDER BY atualizado_em DESC LIMIT 200`,
      motoristaId ? [desde, motoristaId] : [desde],
    ),
    query(
      `SELECT c.id, c.natureza, c.tipo, c.prioridade, c.status, c.atualizado_em
         FROM chamados c
         ${motoristaId ? 'JOIN atribuicoes a ON a.chamado_id = c.id AND a.motorista_id = $2' : ''}
        WHERE c.atualizado_em >= $1
        ORDER BY c.atualizado_em DESC LIMIT 200`,
      motoristaId ? [desde, motoristaId] : [desde],
    ),
    query(
      `SELECT id, tipo, titulo, lida, criado_em FROM notificacoes
        WHERE criado_em >= $1 ${motoristaId ? 'AND destinatario_id = $2' : ''}
        ORDER BY criado_em DESC LIMIT 100`,
      motoristaId ? [desde, motoristaId] : [desde],
    ),
  ]);

  res.json({
    desde,
    servidor_em: new Date().toISOString(),
    turnos: turnos.rows,
    atendimentos: atendimentos.rows,
    chamados: chamados.rows,
    notificacoes: notificacoes.rows,
  });
});

module.exports = { sincronizar, estado, TIPOS, ordenarPorEvento };
