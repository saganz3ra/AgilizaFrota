/**
 * Rotas de chamados, alertas e atribuicao (RF05/RF06/RF07/RF08).
 * - Criacao/listagem/cancelamento/atribuicao: central (autenticado).
 * - Stream SSE: central (token via header ou ?token= para o EventSource).
 * - Criacao por sistema externo: chave de API (X-API-Key).
 */
const { Router } = require('express');
const { autenticar, autenticarEventStream } = require('../middlewares/authMiddleware');
const { autorizarPapel } = require('../middlewares/authorizeRole');
const { autenticarSistemaExterno } = require('../middlewares/apiKey');
const { validate } = require('../middlewares/validate');
const ctrl = require('../controllers/chamadoController');
const atribuicaoCtrl = require('../controllers/atribuicaoController');
const rotaCtrl = require('../controllers/rotaController');
const { criarChamado, idParam, listarChamados } = require('../validators/chamadoValidators');
const {
  atribuirChamado,
  cancelarAtribuicao,
  listarSugestoes,
  idParam: idParamAtribuicao,
} = require('../validators/atribuicaoValidators');

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

// Tempo estimado de chegada do chamado (RF16).
router.get(
  '/:id/eta',
  autenticar,
  autorizarPapel('central', 'motorista'),
  validate(idParam),
  rotaCtrl.etaDoChamado,
);

// Atribuicao e sugestao (RF07/RF08).
router.get(
  '/:id/sugestoes',
  autenticar,
  autorizarPapel('central'),
  validate(listarSugestoes),
  atribuicaoCtrl.sugestoes,
);
router.get(
  '/:id/atribuicoes',
  autenticar,
  autorizarPapel('central'),
  validate(idParamAtribuicao),
  atribuicaoCtrl.historico,
);
router.post(
  '/:id/atribuir',
  autenticar,
  autorizarPapel('central'),
  validate(atribuirChamado),
  atribuicaoCtrl.atribuir,
);
router.post(
  '/:id/atribuicao/cancelar',
  autenticar,
  autorizarPapel('central'),
  validate(cancelarAtribuicao),
  atribuicaoCtrl.cancelarAtribuicao,
);

module.exports = router;
