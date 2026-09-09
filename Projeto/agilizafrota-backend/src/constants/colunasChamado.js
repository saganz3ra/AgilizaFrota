/**
 * Colunas publicas do chamado - definicao unica.
 *
 * Por que isto existe: a lista estava repetida em `chamadoController` e
 * `atribuicaoController`, e o `atendimentoController` publicava no SSE uma
 * projecao REDUZIDA (so id, status, natureza, prioridade, tipo). O painel
 * web substitui o item da lista pelo objeto que chega no evento, entao um
 * chamado concluido pelo app perdia `aberto_em` e a data virava
 * "Invalid Date" na tela.
 *
 * O evento `chamado:atualizado` e um CONTRATO: quem escuta espera sempre o
 * mesmo formato, venha ele de qual controller vier. Manter a lista num so
 * lugar impede que a divergencia volte.
 */
const COLUNAS_CHAMADO = `id, tipo, prioridade, natureza, descricao, status, origem_tipo,
                         criado_por, solicitante_nome, solicitante_telefone,
                         origem_endereco, origem_lat, origem_lng,
                         destino_unidade_id, destino_endereco, aberto_em,
                         criado_em, atualizado_em`;

module.exports = { COLUNAS_CHAMADO };
