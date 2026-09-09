/** Schemas Zod para a sincronizacao offline (RNF03). */
const { z } = require('zod');

const dataHora = z.string().datetime({ offset: true, message: 'Data/hora deve estar em ISO 8601.' });

const item = z.object({
  id_local: z.string().max(80).optional(),      // id da fila no aparelho
  tipo: z.enum(['turno_iniciar', 'turno_encerrar', 'atendimento_iniciar', 'atendimento_marco', 'posicao']),
  marco: z.enum(['chegada_local', 'inicio_transporte', 'concluir', 'cancelar']).optional(),
  ocorrido_em: dataHora.optional(),             // usado para ordenar o pacote
  params: z.record(z.string()).optional(),      // ex.: { id: "<uuid do turno>" }
  dados: z.record(z.any()).optional(),
});

const sincronizar = z.object({
  body: z.object({
    itens: z.array(item).min(1, 'Envie ao menos um item.').max(200),
  }),
});

const estado = z.object({ query: z.object({ desde: dataHora.optional() }) });

module.exports = { sincronizar, estado };
