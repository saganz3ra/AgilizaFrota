/**
 * Schemas Zod para chamados (RF05).
 */
const { z } = require('zod');

const TIPOS = ['urgencia', 'emergencia'];
const PRIORIDADES = ['baixa', 'media', 'alta', 'critica'];

const uuid = z.string().uuid('Deve ser um UUID valido.');
const dataHora = z
  .string()
  .datetime({ offset: true, message: 'Data/hora deve estar em ISO 8601.' });
const coordenada = z.number().refine((v) => v >= -180 && v <= 180, 'Coordenada invalida.');

// Corpo comum de criacao de chamado (usado pela central e pelo sistema externo).
const corpoChamado = z.object({
  id: uuid.optional(), // idempotencia (id gerado na origem)
  tipo: z.enum(TIPOS, { errorMap: () => ({ message: 'Tipo deve ser urgencia ou emergencia.' }) }),
  prioridade: z.enum(PRIORIDADES).optional(),
  natureza: z.string().trim().min(3, 'Descreva a natureza do atendimento.').max(150),
  descricao: z.string().trim().max(2000).optional(),
  solicitante_nome: z.string().trim().max(100).optional(),
  solicitante_telefone: z.string().trim().max(20).optional(),
  origem_endereco: z.string().trim().max(500).optional(),
  origem_lat: coordenada.optional(),
  origem_lng: coordenada.optional(),
  destino_unidade_id: uuid.optional(),
  destino_endereco: z.string().trim().max(500).optional(),
  aberto_em: dataHora.optional(),
});

const criarChamado = z.object({ body: corpoChamado });

const idParam = z.object({ params: z.object({ id: uuid }) });

const listarChamados = z.object({
  query: z.object({
    status: z.enum(['aberto', 'atribuido', 'em_atendimento', 'concluido', 'cancelado']).optional(),
    tipo: z.enum(TIPOS).optional(),
    prioridade: z.enum(PRIORIDADES).optional(),
    destino_unidade_id: uuid.optional(),
    desde: dataHora.optional(),
    ate: dataHora.optional(),
  }),
});

module.exports = { criarChamado, idParam, listarChamados, TIPOS, PRIORIDADES };
