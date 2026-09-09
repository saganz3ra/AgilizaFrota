/**
 * Schemas Zod para atribuicao de chamados (RF07/RF08).
 */
const { z } = require('zod');

const uuid = z.string().uuid('Deve ser um UUID valido.');

const idParam = z.object({ params: z.object({ id: uuid }) });

const atribuirChamado = z.object({
  params: z.object({ id: uuid }),
  body: z.object({
    veiculo_id: uuid,
    motorista_id: uuid.optional(),
    origem: z.enum(['manual', 'sugestao']).optional(),
  }),
});

const cancelarAtribuicao = z.object({
  params: z.object({ id: uuid }),
  body: z
    .object({ motivo: z.string().trim().max(300).optional() })
    .optional()
    .default({}),
});

const listarSugestoes = z.object({
  params: z.object({ id: uuid }),
  query: z.object({
    limite: z.coerce.number().int().min(1).max(20).optional(),
  }),
});

module.exports = { idParam, atribuirChamado, cancelarAtribuicao, listarSugestoes };
