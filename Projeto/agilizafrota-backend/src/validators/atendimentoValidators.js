/**
 * Schemas Zod para atendimentos (RF09/RF10).
 * Campos de offline/idempotencia (RNF03): "id" gerado no cliente e "em"
 * (horario do evento) sao opcionais, como nos turnos.
 */
const { z } = require('zod');

const uuid = z.string().uuid('Deve ser um UUID valido.');
const dataHora = z
  .string()
  .datetime({ offset: true, message: 'Data/hora deve estar em ISO 8601.' });
const km = z.number().int().min(0, 'Quilometragem invalida.');

const idParam = z.object({ params: z.object({ id: uuid }) });

const iniciarAtendimento = z.object({
  body: z.object({
    id: uuid.optional(),
    chamado_id: uuid,
    km_saida: km,
    inicio_em: dataHora.optional(),
  }),
});

const chegadaLocal = z.object({
  params: z.object({ id: uuid }),
  body: z.object({ km_local: km, em: dataHora.optional() }),
});

const iniciarTransporte = z.object({
  params: z.object({ id: uuid }),
  body: z.object({ em: dataHora.optional() }).optional().default({}),
});

const concluirAtendimento = z.object({
  params: z.object({ id: uuid }),
  body: z.object({
    km_final: km,
    em: dataHora.optional(),
    observacoes: z.string().trim().max(2000).optional(),
  }),
});

const cancelarAtendimento = z.object({
  params: z.object({ id: uuid }),
  body: z.object({ motivo: z.string().trim().max(300).optional() }).optional().default({}),
});

// RF10 - validacao manual dos calculos pela central.
const validarAtendimento = z.object({
  params: z.object({ id: uuid }),
  body: z.object({
    aprovado: z.boolean(),
    km_total_ajustado: km.optional(),
    tempo_total_ajustado_min: z.number().int().min(0).optional(),
    observacao: z.string().trim().max(1000).optional(),
  }),
});

const listarAtendimentos = z.object({
  query: z.object({
    status: z.enum(['a_caminho', 'no_local', 'em_transporte', 'concluido', 'cancelado']).optional(),
    chamado_id: uuid.optional(),
    veiculo_id: uuid.optional(),
    motorista_id: uuid.optional(),
    validado: z.enum(['true', 'false']).optional(),
    desde: dataHora.optional(),
    ate: dataHora.optional(),
  }),
});

module.exports = {
  idParam,
  iniciarAtendimento,
  chegadaLocal,
  iniciarTransporte,
  concluirAtendimento,
  cancelarAtendimento,
  validarAtendimento,
  listarAtendimentos,
};
