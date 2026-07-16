/**
 * Controle de acesso baseado em papel - RBAC (RF01 / RNF01).
 * Deve ser usado sempre APOS o middleware "autenticar".
 *
 * Exemplo:
 *   router.post('/veiculos', autenticar, autorizarPapel('central'), handler);
 */
const { AppError } = require('../utils/AppError');

function autorizarPapel(...papeisPermitidos) {
  return function (req, _res, next) {
    if (!req.usuario) {
      return next(new AppError(401, 'Nao autenticado.', 'NAO_AUTENTICADO'));
    }
    if (!papeisPermitidos.includes(req.usuario.papel)) {
      return next(
        new AppError(403, 'Acesso negado para o seu perfil.', 'ACESSO_NEGADO'),
      );
    }
    return next();
  };
}

module.exports = { autorizarPapel };
