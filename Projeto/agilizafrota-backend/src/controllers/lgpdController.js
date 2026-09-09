/**
 * Endpoints de LGPD (RNF02).
 * O titular exerce seus direitos sobre os PROPRIOS dados; a central executa
 * a anonimizacao e a retencao (acoes administrativas, todas auditadas).
 */
const { asyncHandler } = require('../utils/asyncHandler');
const { AppError } = require('../utils/AppError');
const lgpd = require('../services/lgpd');

// GET /api/lgpd/termo - finalidades e versao vigente do termo.
const termo = asyncHandler(async (_req, res) => {
  res.json({
    versao: lgpd.VERSAO_TERMO,
    finalidades: Object.entries(lgpd.FINALIDADES).map(([finalidade, descricao]) => ({
      finalidade,
      descricao,
    })),
    retencao_dias: lgpd.RETENCAO_DIAS,
    direitos:
      'Acesso, portabilidade, correcao, revogacao do consentimento e anonimizacao ' +
      '(art. 18 da Lei 13.709/2018).',
  });
});

// GET /api/lgpd/consentimentos - situacao do proprio titular.
const meusConsentimentos = asyncHandler(async (req, res) => {
  res.json({ usuario_id: req.usuario.id, consentimentos: await lgpd.situacaoConsentimentos(req.usuario.id) });
});

// POST /api/lgpd/consentimentos - registra ou revoga.
const registrarConsentimento = asyncHandler(async (req, res) => {
  const registro = await lgpd.registrarConsentimento({
    usuarioId: req.usuario.id,
    finalidade: req.body.finalidade,
    aceito: req.body.aceito,
    ip: req.headers['x-forwarded-for'] || req.ip,
    userAgent: req.headers['user-agent'],
  });
  res.status(201).json({ consentimento: registro });
});

// GET /api/lgpd/meus-dados - acesso e portabilidade.
const meusDados = asyncHandler(async (req, res) => {
  const dados = await lgpd.exportarDados(req.usuario.id);
  if (req.query.download === 'true') {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="meus-dados-agilizafrota.json"');
  }
  res.json(dados);
});

// GET /api/lgpd/usuarios/:id/dados - central, para atender solicitacao formal.
const dadosDeUsuario = asyncHandler(async (req, res) => {
  res.json(await lgpd.exportarDados(req.params.id));
});

// POST /api/lgpd/usuarios/:id/anonimizar - central.
const anonimizar = asyncHandler(async (req, res) => {
  if (req.params.id === req.usuario.id) {
    throw new AppError(
      409,
      'Um operador nao pode anonimizar a propria conta (evita perder o acesso administrativo).',
      'AUTO_ANONIMIZACAO',
    );
  }
  const resultado = await lgpd.anonimizarUsuario(req.params.id, req.usuario.id);
  res.json({
    ...resultado,
    mensagem:
      'Dados pessoais removidos. Os registros operacionais foram preservados sem identificacao.',
  });
});

// POST /api/lgpd/retencao - central. Simula por padrao; so apaga com executar=true.
const retencao = asyncHandler(async (req, res) => {
  const executar = req.body && req.body.executar === true;
  const resultado = await lgpd.aplicarRetencao({ executar });
  res.json({
    ...resultado,
    mensagem: executar
      ? 'Politica de retencao aplicada.'
      : 'Simulacao: nada foi removido. Envie {"executar": true} para aplicar.',
  });
});

module.exports = {
  termo,
  meusConsentimentos,
  registrarConsentimento,
  meusDados,
  dadosDeUsuario,
  anonimizar,
  retencao,
};
