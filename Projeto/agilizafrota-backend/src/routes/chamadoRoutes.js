/**
 * Rotas de chamados e alertas (RF05/RF06).
 * - Criacao/listagem/cancelamento: central (autenticado).
 * - Stream SSE: central (token via header ou ?token= para o EventSource).
 * - Criacao por sistema externo: chave de API (X-API-Key).
 */
const { Router } = require('express');
const { autenticar, autenticarEventStream } = require('../middlewares/authMiddleware');
const { autorizarPapel } = require('../middlewares/authorizeRole');
const { autenticarSistemaExterno } = require('../middlewares/apiKey');
const { validate } = require('../middlewares/validate');
const ctrl = require('../controllers/chamadoController');
const { criarChamado, idParam, listarChamados } = require('../validators/chamadoValidators');

const router = Router();

// Stream de alertas (SSE) - antes de "/:id" e com auth flexivel para EventSource.
router.get('/stream', autenticarEventStream, autorizarPapel('central'), ctrl.stream);

// Abertura por sistema externo (chave de API).
router.post('/externo', autenticarSistemaExterno, validate(criarChamado), ctrl.criarExterno);

// Operacoes da central (autenticadas).
router.get('/', autenticar, autorizarPapel('central'), validate(listarChamados), ctrl.listar);
router.get('/:id', autenticar, autorizarPapel('central'), validate(idParam), ctrl.obter);
router.post('/', autenticar, autorizarPapel('central'), validate(criarChamado), ctrl.criar);
router.patch('/:id/cancelar', autenticar, autorizarPapel('central'), validate(idParam), ctrl.cancelar);

module.exports = router;
