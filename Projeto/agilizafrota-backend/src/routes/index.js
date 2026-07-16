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

const router = Router();

router.use('/', healthRoutes);
router.use('/auth', authRoutes);
router.use('/unidades', unidadeRoutes);
router.use('/veiculos', veiculoRoutes);
router.use('/usuarios', usuarioRoutes);
router.use('/turnos', turnoRoutes);
router.use('/chamados', chamadoRoutes);

module.exports = router;
