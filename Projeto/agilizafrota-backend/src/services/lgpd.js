/**
 * LGPD - nivel basico (RNF02).
 *
 * Tres direitos do titular implementados de forma concreta:
 *  1. CONSENTIMENTO informado, por finalidade, com registro e revogacao.
 *  2. PORTABILIDADE/ACESSO: o titular obtem tudo o que o sistema guarda
 *     sobre ele, em JSON.
 *  3. ANONIMIZACAO ("esquecimento" possivel): os dados pessoais sao
 *     substituidos, mas os registros operacionais permanecem - sem
 *     identificar a pessoa. Apagar os atendimentos destruiria o historico
 *     da frota publica e a auditoria exigida pela fiscalizacao; anonimizar
 *     concilia os dois interesses (art. 12 da LGPD).
 *
 * Tambem concentra a POLITICA DE RETENCAO: as posicoes de GPS revelam
 * deslocamento e sao o dado mais sensivel do sistema, por isso tem o prazo
 * mais curto.
 */
const crypto = require('crypto');
const { query, pool } = require('../config/db');

const VERSAO_TERMO = process.env.LGPD_VERSAO_TERMO || '1.0';

const FINALIDADES = {
  uso_do_sistema: 'Registrar turnos, checklists e atendimentos para a operacao da frota.',
  geolocalizacao: 'Rastrear a posicao do veiculo durante o turno para coordenar os atendimentos.',
  comunicacoes: 'Enviar notificacoes operacionais (ex.: acionamento e chegada).',
};

// Prazos de retencao (dias). Configuraveis por ambiente.
const RETENCAO_DIAS = {
  posicoes: Number(process.env.RETENCAO_POSICOES_DIAS || 180),      // 6 meses
  notificacoes: Number(process.env.RETENCAO_NOTIFICACOES_DIAS || 365),
  auditoria: Number(process.env.RETENCAO_AUDITORIA_DIAS || 1825),   // 5 anos (fiscalizacao)
};

/** Registra (ou reafirma) o consentimento de uma finalidade. */
async function registrarConsentimento({ usuarioId, finalidade, aceito, ip, userAgent }) {
  if (!FINALIDADES[finalidade]) {
    const err = new Error('Finalidade desconhecida.');
    err.statusCode = 400;
    err.codigo = 'FINALIDADE_INVALIDA';
    err.isOperational = true;
    throw err;
  }

  // Revoga o vigente antes de gravar o novo (mantem o historico).
  await query(
    `UPDATE consentimentos SET revogado_em = CURRENT_TIMESTAMP
      WHERE usuario_id = $1 AND finalidade = $2 AND revogado_em IS NULL`,
    [usuarioId, finalidade],
  );

  const { rows } = await query(
    `INSERT INTO consentimentos (usuario_id, finalidade, versao_termo, aceito, ip, user_agent)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, usuario_id, finalidade, versao_termo, aceito, aceito_em, revogado_em`,
    [usuarioId, finalidade, VERSAO_TERMO, aceito !== false, ip || null, userAgent || null],
  );
  return rows[0];
}

/** Situacao atual de cada finalidade para o titular. */
async function situacaoConsentimentos(usuarioId) {
  const { rows } = await query(
    `SELECT finalidade, versao_termo, aceito, aceito_em
       FROM consentimentos
      WHERE usuario_id = $1 AND revogado_em IS NULL`,
    [usuarioId],
  );
  const porFinalidade = Object.fromEntries(rows.map((r) => [r.finalidade, r]));
  return Object.entries(FINALIDADES).map(([finalidade, descricao]) => ({
    finalidade,
    descricao,
    versao_termo: VERSAO_TERMO,
    consentido: Boolean(porFinalidade[finalidade] && porFinalidade[finalidade].aceito),
    aceito_em: porFinalidade[finalidade] ? porFinalidade[finalidade].aceito_em : null,
    desatualizado: Boolean(
      porFinalidade[finalidade] && porFinalidade[finalidade].versao_termo !== VERSAO_TERMO,
    ),
  }));
}

/** Reune tudo o que o sistema guarda sobre o titular (acesso/portabilidade). */
async function exportarDados(usuarioId) {
  const [usuario, consent, turnos, atendimentos, notificacoes, posicoes] = await Promise.all([
    query(
      `SELECT id, nome, email, papel, telefone, unidade_id, ativo, anonimizado, criado_em
         FROM usuarios WHERE id = $1`,
      [usuarioId],
    ),
    query('SELECT finalidade, versao_termo, aceito, aceito_em, revogado_em FROM consentimentos WHERE usuario_id = $1', [usuarioId]),
    query('SELECT id, veiculo_id, status, km_inicial, km_final, inicio_em, fim_em FROM turnos WHERE motorista_id = $1 ORDER BY inicio_em DESC', [usuarioId]),
    query(
      `SELECT id, chamado_id, veiculo_id, status, distancia_total_km, tempo_total_min, inicio_em, fim_em
         FROM atendimentos WHERE motorista_id = $1 ORDER BY inicio_em DESC`,
      [usuarioId],
    ),
    query('SELECT id, tipo, titulo, lida, criado_em FROM notificacoes WHERE destinatario_id = $1 ORDER BY criado_em DESC LIMIT 500', [usuarioId]),
    query('SELECT COUNT(*)::int AS total, MIN(registrado_em) AS primeira, MAX(registrado_em) AS ultima FROM posicoes WHERE motorista_id = $1', [usuarioId]),
  ]);

  return {
    gerado_em: new Date().toISOString(),
    titular: usuario.rows[0] || null,
    consentimentos: consent.rows,
    turnos: turnos.rows,
    atendimentos: atendimentos.rows,
    notificacoes: notificacoes.rows,
    // Posicoes: resumo (o volume bruto vai por solicitacao formal).
    posicoes_gps: posicoes.rows[0],
    observacao:
      'Dados operacionais vinculados a frota (atendimentos, turnos) sao mantidos por ' +
      'obrigacao de prestacao de contas do servico publico, conforme a base legal ' +
      'de cumprimento de obrigacao legal/regulatoria e execucao de politicas publicas.',
  };
}

/**
 * Anonimiza o titular: remove os identificadores diretos e desliga o acesso,
 * preservando os registros operacionais (agora nao identificaveis).
 */
async function anonimizarUsuario(usuarioId, executadoPor) {
  const atual = await query('SELECT id, papel, anonimizado FROM usuarios WHERE id = $1', [usuarioId]);
  if (atual.rows.length === 0) {
    const err = new Error('Usuario nao encontrado.');
    err.statusCode = 404;
    err.codigo = 'USUARIO_NAO_ENCONTRADO';
    err.isOperational = true;
    throw err;
  }
  if (atual.rows[0].anonimizado) {
    const err = new Error('Usuario ja esta anonimizado.');
    err.statusCode = 409;
    err.codigo = 'JA_ANONIMIZADO';
    err.isOperational = true;
    throw err;
  }

  // Pseudonimo estavel: nao permite voltar ao dado original, mas evita colisao.
  const apelido = crypto.createHash('sha256').update(usuarioId).digest('hex').slice(0, 12);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `UPDATE usuarios
          SET nome = $2, email = $3, telefone = NULL, firebase_uid = $4,
              ativo = FALSE, anonimizado = TRUE, anonimizado_em = CURRENT_TIMESTAMP
        WHERE id = $1
        RETURNING id, nome, email, papel, ativo, anonimizado, anonimizado_em`,
      [usuarioId, `Titular anonimizado ${apelido}`, `anonimo-${apelido}@invalido.local`, `anon-${apelido}`],
    );
    // O e-mail tambem some do rastro de auditoria (o id permanece).
    await client.query(
      "UPDATE auditoria SET usuario_email = 'anonimizado' WHERE usuario_id = $1",
      [usuarioId],
    );
    await client.query('COMMIT');
    return { usuario: rows[0], executado_por: executadoPor };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Aplica a politica de retencao. Sem `executar`, apenas SIMULA (conta o que
 * seria removido) - a exclusao de dados nunca deve acontecer por engano.
 */
async function aplicarRetencao({ executar = false } = {}) {
  const alvos = [
    { tabela: 'posicoes', campo: 'registrado_em', dias: RETENCAO_DIAS.posicoes },
    { tabela: 'notificacoes', campo: 'criado_em', dias: RETENCAO_DIAS.notificacoes },
    { tabela: 'auditoria', campo: 'criado_em', dias: RETENCAO_DIAS.auditoria },
  ];

  const resultado = [];
  for (const alvo of alvos) {
    const corte = `CURRENT_TIMESTAMP - INTERVAL '${alvo.dias} days'`;
    const contagem = await query(
      `SELECT COUNT(*)::int AS n FROM ${alvo.tabela} WHERE ${alvo.campo} < ${corte}`,
    );
    let removidos = 0;
    if (executar && contagem.rows[0].n > 0) {
      const del = await query(`DELETE FROM ${alvo.tabela} WHERE ${alvo.campo} < ${corte}`);
      removidos = del.rowCount;
    }
    resultado.push({
      tabela: alvo.tabela,
      retencao_dias: alvo.dias,
      elegiveis: contagem.rows[0].n,
      removidos,
    });
  }
  return { simulacao: !executar, alvos: resultado };
}

module.exports = {
  VERSAO_TERMO,
  FINALIDADES,
  RETENCAO_DIAS,
  registrarConsentimento,
  situacaoConsentimentos,
  exportarDados,
  anonimizarUsuario,
  aplicarRetencao,
};
