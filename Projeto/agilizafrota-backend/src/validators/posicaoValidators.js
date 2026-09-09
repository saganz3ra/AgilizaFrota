/**
 * Schemas Zod para posicoes GPS (RF11/RNF10).
 */
const { z } = require('zod');

const uuid = z.string().uuid('Deve ser um UUID valido.');
const dataHora = z
  .string()
  .datetime({ offset: true, message: 'Data/hora deve estar em ISO 8601.' });

const pontoGps = z.object({
  veiculo_id: uuid.optional(), // se omitido, usa o veiculo do turno aberto
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  precisao_m: z.number().min(0).max(100000).optional(),
  velocidade_kmh: z.number().min(0).max(500).optional(),
  direcao_graus: z.number().min(0).max(360).optional(),
  altitude_m: z.number().optional(),
  bateria_pct: z.number().int().min(0).max(100).optional(),
  atendimento_id: uuid.optional(),
  registrado_em: dataHora,
});

const enviarPosicao = z.object({ body: pontoGps });

// Lote: usado quando o app recupera o sinal apos operar offline (RNF10/RNF03).
const enviarLote = z.object({
  body: z.object({
    veiculo_id: uuid.optional(),
    posicoes: z.array(pontoGps).min(1, 'Envie ao menos uma posicao.').max(500),
  }),
});

const listarFrota = z.object({
  query: z.object({
    status: z.enum(['online', 'instavel', 'offline', 'sem_dados']).optional(),
    unidade_id: uuid.optional(),
  }),
});

const historicoPosicoes = z.object({
  params: z.object({ id: uuid }),
  query: z.object({
    desde: dataHora.optional(),
    ate: dataHora.optional(),
    limite: z.coerce.number().int().min(1).max(1000).optional(),
    incluir_descartadas: z.enum(['true', 'false']).optional(),
  }),
});

module.exports = { enviarPosicao, enviarLote, listarFrota, historicoPosicoes };
