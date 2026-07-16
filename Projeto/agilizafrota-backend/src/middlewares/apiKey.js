/**
 * Autenticacao do "sistema externo" via chave de API (cabecalho X-API-Key).
 * Usado apenas no endpoint de abertura de chamados por sistemas externos
 * (ex.: regulacao/SAMU). Nao concede acesso as demais rotas.
 */
const { env } = require('../config/env');
const { AppError } = require('../utils/AppError');

function autenticarSistemaExterno(req, _res, next) {
  if (!env.externalApiKey) {
    return next(new AppError(503, 'Integracao com sistema externo nao configurada.', 'EXTERNO_DESABILITADO'));
  }
  const chave = req.headers['x-api-key'];
  if (!chave || chave !== env.externalApiKey) {
    return next(new AppError(401, 'Chave de API invalida ou ausente.', 'API_KEY_INVALIDA'));
  }
  req.origemExterna = true;
  next();
}

module.exports = { autenticarSistemaExterno };
