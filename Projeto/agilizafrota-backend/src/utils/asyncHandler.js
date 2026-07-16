/**
 * Envolve um handler assincrono do Express e encaminha qualquer erro
 * para o middleware de tratamento de erros (evita try/catch repetido).
 */
function asyncHandler(fn) {
  return function (req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = { asyncHandler };
