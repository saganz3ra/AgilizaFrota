/**
 * Schemas Zod para notificacoes (RF15) e historico (RF12).
 */
const { z } = require('zod');

const uuid = z.string().uuid('Deve ser um UUID valido.');
const dataHora = z.string().datetime({ offset: true, message: 'Data/hora deve estar em ISO 8601.' });

const idParam = z.object({ params: z.object({ id: uuid }) });

const listarNotificacoes = z.object({
  query: z.object({
    lida: z.enum(['true', 'false']).optional(),
    tipo: z.enum(['chegada_veiculo', 'chamado_atribuido', 'atendimento_concluido', 'aviso']).optional(),
    limite: z.coerce.number().int().min(1).max(500).optional(),
  }),
});

const historicoLista = z.object({
  query: z.object({
    motorista_id: uuid.optional(),
    veiculo_id: uuid.optional(),
    unidade_id: uuid.optional(),
    desde: dataHora.optional(),
    ate: dataHora.optional(),
    limite: z.coerce.number().int().min(1).max(500).optional(),
    offset: z.coerce.number().int().min(0).optional(),
  }),
});

const historicoPorId = z.object({
  params: z.object({ id: uuid }),
  query: z.object({ desde: dataHora.optional(), ate: dataHora.optional() }),
});

const historicoResumo = z.object({
  query: z.object({ desde: dataHora.optional(), ate: dataHora.optional() }),
});

module.exports = { idParam, listarNotificacoes, historicoLista, historicoPorId, historicoResumo };
