/**
 * Agregador de rotas da API. Prefixo base: /api
 */
const { Router } = require('express');
const healthRoutes = require('./healthRoutes');
const authRoutes = require('./authRoutes');
const unidadeRoutes = require('./unidadeRoutes');
const veiculoRoutes = require('./veiculoRoutes');
const usuarioRoutes = require('./usuarioRoutes');
const turnoRoutes = require('./turnoRoutes');
const chamadoRoutes = require('./chamadoRoutes');
const atendimentoRoutes = require('./atendimentoRoutes');
const posicaoRoutes = require('./posicaoRoutes');
const frotaRoutes = require('./frotaRoutes');
const notificacaoRoutes = require('./notificacaoRoutes');
const historicoRoutes = require('./historicoRoutes');
const motoristaRoutes = require('./motoristaRoutes');
const rotaRoutes = require('./rotaRoutes');
const relatorioRoutes = require('./relatorioRoutes');
const auditoriaRoutes = require('./auditoriaRoutes');
const lgpdRoutes = require('./lgpdRoutes');
const metricaRoutes = require('./metricaRoutes');
const syncRoutes = require('./syncRoutes');

const router = Router();

router.use('/', healthRoutes);
router.use('/auth', authRoutes);
router.use('/unidades', unidadeRoutes);
router.use('/veiculos', veiculoRoutes);
router.use('/usuarios', usuarioRoutes);
router.use('/turnos', turnoRoutes);
router.use('/chamados', chamadoRoutes);
router.use('/atendimentos', atendimentoRoutes);
router.use('/posicoes', posicaoRoutes);
router.use('/frota', frotaRoutes);
router.use('/notificacoes', notificacaoRoutes);
router.use('/historico', historicoRoutes);
router.use('/motorista', motoristaRoutes);
router.use('/rotas', rotaRoutes);
router.use('/relatorios', relatorioRoutes);
router.use('/auditoria', auditoriaRoutes);
router.use('/lgpd', lgpdRoutes);
router.use('/metricas', metricaRoutes);
router.use('/sync', syncRoutes);

module.exports = router;
