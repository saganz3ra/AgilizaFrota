/**
 * Middlewares de 404 e de tratamento centralizado de erros.
 *
 * - notFound: rota inexistente vira um AppError 404.
 * - errorHandler: formata a resposta de erro de forma consistente e NAO
 *   vaza stack trace em producao (RNF01 - seguranca/integridade).
 */
const { AppError } = require('../utils/AppError');
const { env } = require('../config/env');

function notFound(req, _res, next) {
  next(new AppError(404, `Rota nao encontrada: ${req.method} ${req.originalUrl}`, 'ROTA_NAO_ENCONTRADA'));
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, _req, res, _next) {
  const statusCode = err.statusCode || 500;
  const isOperational = err.isOperational === true;

  // Erros inesperados (nao operacionais) sao sempre logados.
  if (!isOperational || statusCode >= 500) {
    console.error('[erro]', err);
  }

  const corpo = {
    erro: isOperational ? err.message : 'Erro interno do servidor.',
    codigo: err.codigo || 'ERRO_INTERNO',
  };

  if (err.detalhes) corpo.detalhes = err.detalhes;

  // Stack apenas fora de producao, para depuracao.
  if (!env.isProduction && err.stack) corpo.stack = err.stack;

  res.status(statusCode).json(corpo);
}

module.exports = { notFound, errorHandler };
