/**
 * Schemas Zod para as rotas de veiculos (RF02).
 */
const { z } = require('zod');

const STATUS = ['disponivel', 'em_uso', 'manutencao'];

// Placa: aceita formato antigo (ABC1234) e Mercosul (ABC1D23).
const placa = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{3}[0-9][0-9A-Z][0-9]{2}$/, 'Placa invalida (use ABC1234 ou ABC1D23).');

const anoAtual = new Date().getFullYear();

const idParam = z.object({
  params: z.object({ id: z.string().uuid('id deve ser um UUID valido.') }),
});

const criarVeiculo = z.object({
  body: z.object({
    placa,
    modelo: z.string().trim().min(1, 'Modelo obrigatorio.').max(50),
    marca: z.string().trim().max(30).optional(),
    ano: z.number().int().min(1950).max(anoAtual + 1).optional(),
    quilometragem_atual: z.number().int().min(0).optional(),
    status: z.enum(STATUS).optional(),
    unidade_id: z.string().uuid('unidade_id deve ser um UUID valido.').optional(),
    ultima_revisao: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data deve ser YYYY-MM-DD.').optional(),
  }),
});

const atualizarVeiculo = z.object({
  params: z.object({ id: z.string().uuid('id deve ser um UUID valido.') }),
  body: z
    .object({
      placa: placa.optional(),
      modelo: z.string().trim().min(1).max(50).optional(),
      marca: z.string().trim().max(30).optional(),
      ano: z.number().int().min(1950).max(anoAtual + 1).optional(),
      quilometragem_atual: z.number().int().min(0).optional(),
      status: z.enum(STATUS).optional(),
      unidade_id: z.string().uuid().nullable().optional(),
      ultima_revisao: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data deve ser YYYY-MM-DD.').optional(),
      ativo: z.boolean().optional(),
    })
    .refine((o) => Object.keys(o).length > 0, 'Informe ao menos um campo para atualizar.'),
});

const alterarStatus = z.object({
  params: z.object({ id: z.string().uuid('id deve ser um UUID valido.') }),
  body: z.object({
    status: z.enum(STATUS, { errorMap: () => ({ message: 'Status invalido.' }) }),
  }),
});

const listarVeiculos = z.object({
  query: z.object({
    status: z.enum(STATUS).optional(),
    unidade_id: z.string().uuid().optional(),
    ativo: z.enum(['true', 'false']).optional(),
  }),
});

module.exports = {
  idParam,
  criarVeiculo,
  atualizarVeiculo,
  alterarStatus,
  listarVeiculos,
  STATUS,
};
