/**
 * Schemas Zod para rotas e ETA (RF16/RF17).
 */
const { z } = require('zod');

const uuid = z.string().uuid('Deve ser um UUID valido.');
const coordenada = z.coerce.number();

const pontos = z.object({
  origem_lat: coordenada.refine((v) => v >= -90 && v <= 90, 'Latitude invalida.'),
  origem_lng: coordenada.refine((v) => v >= -180 && v <= 180, 'Longitude invalida.'),
  destino_lat: coordenada.refine((v) => v >= -90 && v <= 90, 'Latitude invalida.'),
  destino_lng: coordenada.refine((v) => v >= -180 && v <= 180, 'Longitude invalida.'),
  prioridade: z.enum(['baixa', 'media', 'alta', 'critica']).optional(),
});

const calcularRota = z.object({ query: pontos });
const idParam = z.object({ params: z.object({ id: uuid }) });

module.exports = { calcularRota, idParam };
