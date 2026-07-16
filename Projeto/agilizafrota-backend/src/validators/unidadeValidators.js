/**
 * Schemas Zod para as rotas de unidades (RF02).
 */
const { z } = require('zod');

const idParam = z.object({
  params: z.object({ id: z.string().uuid('id deve ser um UUID valido.') }),
});

const coordenada = z
  .number()
  .refine((v) => v >= -90 && v <= 180, 'Coordenada fora do intervalo valido.');

const criarUnidade = z.object({
  body: z.object({
    nome: z.string().trim().min(3, 'Nome deve ter ao menos 3 caracteres.').max(100),
    endereco: z.string().trim().min(3, 'Endereco obrigatorio.'),
    cidade: z.string().trim().max(50).optional(),
    lat: coordenada.optional(),
    lng: coordenada.optional(),
  }),
});

// Atualizacao parcial: ao menos um campo deve ser enviado.
const atualizarUnidade = z.object({
  params: z.object({ id: z.string().uuid('id deve ser um UUID valido.') }),
  body: z
    .object({
      nome: z.string().trim().min(3).max(100).optional(),
      endereco: z.string().trim().min(3).optional(),
      cidade: z.string().trim().max(50).optional(),
      lat: coordenada.optional(),
      lng: coordenada.optional(),
      ativo: z.boolean().optional(),
    })
    .refine((o) => Object.keys(o).length > 0, 'Informe ao menos um campo para atualizar.'),
});

const listarUnidades = z.object({
  query: z.object({
    ativo: z.enum(['true', 'false']).optional(),
    cidade: z.string().trim().max(50).optional(),
  }),
});

module.exports = { idParam, criarUnidade, atualizarUnidade, listarUnidades };
