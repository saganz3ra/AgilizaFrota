/**
 * Middleware de validacao de entrada baseado em schemas Zod.
 * Valida body, params e query conforme o schema informado e substitui
 * req.body/params/query pelos dados ja validados e normalizados.
 *
 * Contribui para a integridade dos dados (RNF01), rejeitando entradas
 * malformadas antes de chegarem a regra de negocio.
 */
const { ZodError } = require('zod');
const { AppError } = require('../utils/AppError');

function validate(schema) {
  return function (req, _res, next) {
    try {
      const parsed = schema.parse({
        body: req.body,
        params: req.params,
        query: req.query,
      });
      if (parsed.body !== undefined) req.body = parsed.body;
      if (parsed.params !== undefined) req.params = parsed.params;
      if (parsed.query !== undefined) req.query = parsed.query;
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        const detalhes = err.errors.map((e) => ({
          campo: e.path.join('.'),
          mensagem: e.message,
        }));
        const appErr = new AppError(400, 'Dados de entrada invalidos.', 'VALIDACAO');
        appErr.detalhes = detalhes;
        return next(appErr);
      }
      return next(err);
    }
  };
}

module.exports = { validate };
