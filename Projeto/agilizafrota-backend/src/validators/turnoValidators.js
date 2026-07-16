/**
 * Schemas Zod para turnos e checklist (RF03/RF04).
 * Campos de idempotencia/offline (RNF03): "id" gerado no cliente e
 * timestamps de evento ("inicio_em", "fim_em", "realizado_em") sao opcionais.
 */
const { z } = require('zod');
const { CODIGOS_VALIDOS } = require('../constants/checklistItens');

const uuid = z.string().uuid('Deve ser um UUID valido.');
const dataHora = z
  .string()
  .datetime({ offset: true, message: 'Data/hora deve estar em ISO 8601 (ex.: 2026-05-20T08:00:00Z).' });

const respostaChecklist = z.object({
  codigo: z.string().refine((c) => CODIGOS_VALIDOS.has(c), 'Item de checklist desconhecido.'),
  conforme: z.boolean(),
  observacao: z.string().trim().max(300).optional(),
});

const iniciarTurno = z.object({
  body: z.object({
    id: uuid.optional(), // idempotencia (id gerado no cliente)
    veiculo_id: uuid,
    km_inicial: z.number().int().min(0, 'Quilometragem inicial invalida.'),
    foto_inicio_url: z.string().trim().url('foto_inicio_url deve ser uma URL valida.'),
    inicio_em: dataHora.optional(),
    checklist: z.object({
      id: uuid.optional(),
      realizado_em: dataHora.optional(),
      respostas: z.array(respostaChecklist).min(1, 'Informe as respostas do checklist.'),
    }),
  }),
});

const encerrarTurno = z.object({
  params: z.object({ id: uuid }),
  body: z.object({
    km_final: z.number().int().min(0, 'Quilometragem final invalida.'),
    foto_fim_url: z.string().trim().url('foto_fim_url deve ser uma URL valida.'),
    fim_em: dataHora.optional(),
  }),
});

const idParam = z.object({ params: z.object({ id: uuid }) });

const listarTurnos = z.object({
  query: z.object({
    status: z.enum(['aberto', 'encerrado']).optional(),
    veiculo_id: uuid.optional(),
    motorista_id: uuid.optional(),
    desde: dataHora.optional(),
    ate: dataHora.optional(),
  }),
});

module.exports = { iniciarTurno, encerrarTurno, idParam, listarTurnos };
