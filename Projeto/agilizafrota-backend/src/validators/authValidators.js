/**
 * Schemas Zod para as rotas de autenticacao.
 */
const { z } = require('zod');

const PAPEIS = ['motorista', 'central', 'recepcionista'];

// POST /api/auth/register - o usuario provisiona o proprio perfil apos
// autenticar no Firebase. O firebase_uid e o email vem do token (nao do body).
const registerSchema = z.object({
  body: z.object({
    nome: z.string().trim().min(3, 'Nome deve ter ao menos 3 caracteres.').max(100),
    papel: z.enum(PAPEIS, { errorMap: () => ({ message: 'Papel invalido.' }) }),
    unidade_id: z.string().uuid('unidade_id deve ser um UUID valido.').optional(),
    telefone: z.string().trim().max(20).optional(),
  }),
});

// POST /api/auth/bootstrap - cria o primeiro operador "central".
// Protegido por um segredo unico definido em BOOTSTRAP_SECRET.
const bootstrapSchema = z.object({
  body: z.object({
    segredo: z.string().min(1, 'Segredo obrigatorio.'),
    nome: z.string().trim().min(3).max(100),
  }),
});

module.exports = { registerSchema, bootstrapSchema, PAPEIS };
