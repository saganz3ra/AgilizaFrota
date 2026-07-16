/**
 * Schemas Zod para a gestao de usuarios (RF02) - operacoes da central.
 */
const { z } = require('zod');

const PAPEIS = ['motorista', 'central', 'recepcionista'];

const idParam = z.object({
  params: z.object({ id: z.string().uuid('id deve ser um UUID valido.') }),
});

const criarUsuario = z.object({
  body: z.object({
    nome: z.string().trim().min(3, 'Nome deve ter ao menos 3 caracteres.').max(100),
    email: z.string().trim().toLowerCase().email('E-mail invalido.').max(150),
    senha: z.string().min(6, 'Senha deve ter ao menos 6 caracteres.').max(128),
    papel: z.enum(PAPEIS, { errorMap: () => ({ message: 'Papel invalido.' }) }),
    telefone: z.string().trim().max(20).optional(),
    unidade_id: z.string().uuid('unidade_id deve ser um UUID valido.').optional(),
  }),
});

const atualizarUsuario = z.object({
  params: z.object({ id: z.string().uuid('id deve ser um UUID valido.') }),
  body: z
    .object({
      nome: z.string().trim().min(3).max(100).optional(),
      telefone: z.string().trim().max(20).nullable().optional(),
      unidade_id: z.string().uuid().nullable().optional(),
      papel: z.enum(PAPEIS).optional(),
      ativo: z.boolean().optional(),
    })
    .refine((o) => Object.keys(o).length > 0, 'Informe ao menos um campo para atualizar.'),
});

const listarUsuarios = z.object({
  query: z.object({
    papel: z.enum(PAPEIS).optional(),
    unidade_id: z.string().uuid().optional(),
    ativo: z.enum(['true', 'false']).optional(),
  }),
});

module.exports = { idParam, criarUsuario, atualizarUsuario, listarUsuarios, PAPEIS };
