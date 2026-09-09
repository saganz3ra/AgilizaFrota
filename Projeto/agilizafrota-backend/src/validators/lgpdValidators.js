/** Schemas Zod para LGPD (RNF02). */
const { z } = require('zod');

const uuid = z.string().uuid('Deve ser um UUID valido.');

const registrarConsentimento = z.object({
  body: z.object({
    finalidade: z.enum(['uso_do_sistema', 'geolocalizacao', 'comunicacoes']),
    aceito: z.boolean().optional(),
  }),
});

const idParam = z.object({ params: z.object({ id: uuid }) });

const retencao = z.object({
  body: z.object({ executar: z.boolean().optional() }).optional().default({}),
});

module.exports = { registrarConsentimento, idParam, retencao };
