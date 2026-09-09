/**
 * Painel do motorista (RNF11 - minimizar interacoes).
 *
 * Uma unica chamada devolve TUDO o que a tela inicial do app precisa
 * (turno, veiculo, chamado acionado, atendimento em andamento) e ainda
 * sugere a PROXIMA ACAO, com o endpoint e os campos ja preenchidos onde
 * possivel (ex.: a quilometragem atual do veiculo). Assim o motorista
 * abre o app e ve um unico botao do que fazer agora, em vez de navegar
 * por menus e digitar dados que o sistema ja conhece.
 */
const { query } = require('../config/db');
const { asyncHandler } = require('../utils/asyncHandler');
const { ITENS_CHECKLIST } = require('../constants/checklistItens');

/** Decide a proxima acao a partir do estado atual. */
function proximaAcao({ turno, atendimento, atribuicao, veiculo }) {
  if (!turno) {
    return {
      acao: 'iniciar_turno',
      rotulo: 'Iniciar turno',
      endpoint: 'POST /api/turnos/iniciar',
      requer: ['veiculo_id', 'km_inicial', 'foto_inicio_url', 'checklist'],
      dica: 'Selecione o veiculo, faca o checklist e registre a foto do painel.',
    };
  }
  if (atendimento) {
    switch (atendimento.status) {
      case 'a_caminho':
        return {
          acao: 'registrar_chegada',
          rotulo: 'Cheguei ao local',
          endpoint: `PATCH /api/atendimentos/${atendimento.id}/chegada-local`,
          requer: ['km_local'],
          sugestao: { km_local: veiculo ? veiculo.quilometragem_atual : null },
        };
      case 'no_local':
        return {
          acao: 'iniciar_transporte',
          rotulo: 'Iniciar transporte',
          endpoint: `PATCH /api/atendimentos/${atendimento.id}/inicio-transporte`,
          requer: [],
          dica: 'Um toque: o horario e registrado automaticamente.',
        };
      case 'em_transporte':
        return {
          acao: 'concluir_atendimento',
          rotulo: 'Concluir atendimento',
          endpoint: `PATCH /api/atendimentos/${atendimento.id}/concluir`,
          requer: ['km_final'],
          sugestao: { km_final: veiculo ? veiculo.quilometragem_atual : null },
          dica: 'A recepcionista ja foi avisada automaticamente na chegada.',
        };
      default:
        break;
    }
  }
  if (atribuicao) {
    return {
      acao: 'iniciar_atendimento',
      rotulo: 'Iniciar atendimento',
      endpoint: 'POST /api/atendimentos',
      requer: ['chamado_id', 'km_saida'],
      sugestao: {
        chamado_id: atribuicao.chamado_id,
        km_saida: veiculo ? veiculo.quilometragem_atual : null,
      },
    };
  }
  return {
    acao: 'aguardar',
    rotulo: 'Aguardando acionamento',
    endpoint: null,
    requer: [],
    dica: 'Voce sera avisado quando a central acionar um chamado.',
  };
}

// GET /api/motorista/painel
const painel = asyncHandler(async (req, res) => {
  const motoristaId = req.usuario.id;

  const turnoQ = await query(
    `SELECT t.id, t.veiculo_id, t.km_inicial, t.inicio_em,
            v.placa, v.modelo, v.quilometragem_atual, v.status AS status_veiculo
       FROM turnos t JOIN veiculos v ON v.id = t.veiculo_id
      WHERE t.motorista_id = $1 AND t.status = 'aberto'`,
    [motoristaId],
  );
  const turno = turnoQ.rows[0] || null;
  const veiculo = turno
    ? {
        id: turno.veiculo_id,
        placa: turno.placa,
        modelo: turno.modelo,
        quilometragem_atual: turno.quilometragem_atual,
        status: turno.status_veiculo,
      }
    : null;

  const atendQ = await query(
    `SELECT a.id, a.chamado_id, a.status, a.km_saida, a.km_local, a.inicio_em,
            c.natureza, c.tipo, c.prioridade, c.origem_endereco,
            un.nome AS destino_nome
       FROM atendimentos a
       JOIN chamados c ON c.id = a.chamado_id
       LEFT JOIN unidades un ON un.id = c.destino_unidade_id
      WHERE a.motorista_id = $1 AND a.status IN ('a_caminho','no_local','em_transporte')
      ORDER BY a.inicio_em DESC LIMIT 1`,
    [motoristaId],
  );
  const atendimento = atendQ.rows[0] || null;

  const atribQ = await query(
    `SELECT at.id, at.chamado_id, at.atribuido_em,
            c.natureza, c.tipo, c.prioridade, c.origem_endereco,
            un.nome AS destino_nome
       FROM atribuicoes at
       JOIN chamados c ON c.id = at.chamado_id
       LEFT JOIN unidades un ON un.id = c.destino_unidade_id
      WHERE at.status = 'ativa'
        AND (at.motorista_id = $1 OR at.veiculo_id = $2)
      ORDER BY at.atribuido_em DESC LIMIT 1`,
    [motoristaId, turno ? turno.veiculo_id : null],
  );
  const atribuicao = atribQ.rows[0] || null;

  const naoLidas = await query(
    'SELECT COUNT(*)::int AS n FROM notificacoes WHERE destinatario_id = $1 AND lida = FALSE',
    [motoristaId],
  );

  res.json({
    turno,
    veiculo,
    atribuicao,
    atendimento,
    notificacoes_nao_lidas: naoLidas.rows[0].n,
    // O catalogo vai junto para o app montar o checklist sem outra chamada.
    checklist_itens: turno ? undefined : ITENS_CHECKLIST,
    proxima_acao: proximaAcao({ turno, atendimento, atribuicao, veiculo }),
  });
});

module.exports = { painel, proximaAcao };
