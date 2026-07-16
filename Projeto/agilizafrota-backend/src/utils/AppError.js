/**
 * Erro de aplicacao com status HTTP e codigo semantico.
 * Permite lancar erros controlados nos controllers e trata-los de forma
 * centralizada no errorHandler.
 */
class AppError extends Error {
  /**
   * @param {number} statusCode - status HTTP (ex.: 400, 401, 403, 404).
   * @param {string} message - mensagem para o cliente.
   * @param {string} [codigo] - codigo semantico (ex.: 'USUARIO_NAO_ENCONTRADO').
   */
  constructor(statusCode, message, codigo) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.codigo = codigo || 'ERRO';
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = { AppError };
