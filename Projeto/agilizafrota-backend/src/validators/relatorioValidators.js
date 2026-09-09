/**
 * Schemas Zod para relatorios (RF13) e auditoria (RF14).
 */
const { z } = require('zod');

const uuid = z.string().uuid('Deve ser um UUID valido.');
const dataHora = z.string().datetime({ offset: true, message: 'Data/hora deve estar em ISO 8601.' });
const formato = z.enum(['json', 'csv', 'html', 'pdf']).optional();

const relatorioPadrao = z.object({
  query: z.object({
    desde: dataHora.optional(),
    ate: dataHora.optional(),
    formato,
    unidade_id: uuid.optional(),
    status: z.string().max(30).optional(),
  }),
});

const listarAuditoria = z.object({
  query: z.object({
    usuario_id: uuid.optional(),
    entidade: z.string().max(40).optional(),
    entidade_id: uuid.optional(),
    acao: z.string().max(60).optional(),
    sucesso: z.enum(['true', 'false']).optional(),
    desde: dataHora.optional(),
    ate: dataHora.optional(),
    limite: z.coerce.number().int().min(1).max(1000).optional(),
    offset: z.coerce.number().int().min(0).optional(),
  }),
});

const trilhaEntidade = z.object({
  params: z.object({ entidade: z.string().max(40), id: uuid }),
});

module.exports = { relatorioPadrao, listarAuditoria, trilhaEntidade };
