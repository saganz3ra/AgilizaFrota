/**
 * Catalogo fixo de itens do checklist de inspecao da ambulancia (RF04).
 * Itens marcados como "critico" reprovam o checklist se estiverem
 * nao-conformes, impedindo a abertura do turno.
 *
 * Ajuste os itens conforme a realidade da operacao, se necessario.
 */
const ITENS_CHECKLIST = [
  { codigo: 'pneus', descricao: 'Pneus e estepe em bom estado', critico: true },
  { codigo: 'freios', descricao: 'Freios funcionando corretamente', critico: true },
  { codigo: 'luzes_sirene', descricao: 'Faróis, setas, giroflex e sirene', critico: true },
  { codigo: 'equipamentos', descricao: 'Equipamentos de emergência (maca, oxigênio, kit)', critico: true },
  { codigo: 'combustivel', descricao: 'Nível de combustível adequado', critico: false },
  { codigo: 'oleo_agua', descricao: 'Níveis de óleo e água', critico: false },
  { codigo: 'documentos', descricao: 'Documentos do veículo em dia', critico: false },
  { codigo: 'limpeza', descricao: 'Higienização da cabine e do compartimento', critico: false },
];

const CODIGOS_VALIDOS = new Set(ITENS_CHECKLIST.map((i) => i.codigo));
const CODIGOS_CRITICOS = new Set(ITENS_CHECKLIST.filter((i) => i.critico).map((i) => i.codigo));

/**
 * Avalia as respostas do checklist.
 * @returns {{ aprovado: boolean, faltantes: string[], reprovadosCriticos: string[] }}
 */
function avaliarChecklist(respostas) {
  const respondidos = new Map(respostas.map((r) => [r.codigo, r.conforme]));

  // Todos os itens do catalogo precisam ter resposta.
  const faltantes = [];
  for (const item of ITENS_CHECKLIST) {
    if (!respondidos.has(item.codigo)) faltantes.push(item.codigo);
  }

  // Itens criticos nao-conformes reprovam o checklist.
  const reprovadosCriticos = [];
  for (const codigo of CODIGOS_CRITICOS) {
    if (respondidos.get(codigo) === false) reprovadosCriticos.push(codigo);
  }

  const aprovado = faltantes.length === 0 && reprovadosCriticos.length === 0;
  return { aprovado, faltantes, reprovadosCriticos };
}

module.exports = {
  ITENS_CHECKLIST,
  CODIGOS_VALIDOS,
  CODIGOS_CRITICOS,
  avaliarChecklist,
};
