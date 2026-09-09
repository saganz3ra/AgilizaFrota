/**
 * Upload de evidencias fotograficas (RF03).
 * O cliente envia a imagem, recebe a URL e usa essa URL nos campos
 * `foto_inicio_url` / `foto_fim_url` do turno.
 */
const path = require('path');
const { asyncHandler } = require('../utils/asyncHandler');
const { AppError } = require('../utils/AppError');
const { PASTA_UPLOADS } = require('../config/uploads');

/**
 * Monta a URL publica do arquivo.
 *
 * A base vem da PROPRIA requisicao (host que o cliente usou) e nao de uma
 * constante: o mesmo servidor e alcancado por "localhost" no navegador do
 * PC, por "10.0.2.2" no emulador e pelo IP da rede no celular. Fixar um
 * endereco quebraria pelo menos um desses casos.
 * `APP_URL` permite sobrepor isso em producao, atras de proxy reverso.
 */
function montarUrl(req, caminhoRelativo) {
  const base =
    process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
  return `${base.replace(/\/$/, '')}/api/uploads/${caminhoRelativo.replace(/\\/g, '/')}`;
}

// POST /api/upload - campo "arquivo" (multipart/form-data).
const enviar = asyncHandler(async (req, res) => {
  if (!req.file) {
    throw new AppError(400, 'Nenhum arquivo recebido no campo "arquivo".', 'ARQUIVO_AUSENTE');
  }

  const relativo = path.relative(PASTA_UPLOADS, req.file.path);

  res.status(201).json({
    url: montarUrl(req, relativo),
    nome: req.file.filename,
    tamanho_bytes: req.file.size,
    tipo: req.file.mimetype,
    enviado_por: req.usuario.id,
    enviado_em: new Date().toISOString(),
  });
});

module.exports = { enviar, montarUrl };
