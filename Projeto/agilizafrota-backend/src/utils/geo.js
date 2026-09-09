/**
 * Utilitarios geograficos compartilhados (sugestao de veiculo e rastreamento).
 */
const RAIO_TERRA_KM = 6371;

function grausParaRadianos(g) {
  return (g * Math.PI) / 180;
}

/**
 * Distancia aproximada entre dois pontos (Haversine), em km.
 * Retorna null se alguma coordenada estiver ausente/invalida.
 */
function calcularDistanciaKm(lat1, lng1, lat2, lng2) {
  const coords = [lat1, lng1, lat2, lng2].map((v) => (v === null || v === undefined ? null : Number(v)));
  if (coords.some((v) => v === null || Number.isNaN(v))) return null;
  const [la1, ln1, la2, ln2] = coords;
  const dLat = grausParaRadianos(la2 - la1);
  const dLng = grausParaRadianos(ln2 - ln1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(grausParaRadianos(la1)) * Math.cos(grausParaRadianos(la2)) * Math.sin(dLng / 2) ** 2;
  return 2 * RAIO_TERRA_KM * Math.asin(Math.min(1, Math.sqrt(a)));
}

module.exports = { calcularDistanciaKm, RAIO_TERRA_KM };
