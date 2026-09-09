/**
 * Recebimento de evidencias fotograficas (RF03).
 *
 * DECISAO DE PROJETO: as fotos ficam na infraestrutura da propria
 * instituicao, e nao em um servico de terceiros. Alem de evitar a
 * dependencia de um plano pago, isso e mais defensavel do ponto de vista
 * da LGPD - a imagem do painel pode capturar o interior do veiculo e,
 * eventualmente, pessoas. Manter o dado sob o controle do hospital reduz
 * o compartilhamento com operadores externos (art. 6, VIII).
 *
 * O armazenamento e em disco local. Em producao com varias instancias da
 * API isso viraria um volume compartilhado ou um bucket S3/MinIO - o
 * ponto de troca fica isolado aqui.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const { AppError } = require('../utils/AppError');

// Pasta raiz das evidencias. Fora de src/ para nao se misturar ao codigo.
const PASTA_UPLOADS = path.resolve(
  process.env.UPLOAD_DIR || path.join(__dirname, '..', '..', 'uploads'),
);

const TAMANHO_MAXIMO_MB = Number(process.env.UPLOAD_MAX_MB || 8);

// Apenas imagens: o app envia JPEG comprimido.
const TIPOS_PERMITIDOS = new Set(['image/jpeg', 'image/png', 'image/webp']);
const EXTENSAO_POR_TIPO = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

/** Garante que a pasta existe antes do primeiro upload. */
function prepararPasta(subpasta) {
  const destino = path.join(PASTA_UPLOADS, subpasta);
  fs.mkdirSync(destino, { recursive: true });
  return destino;
}

const armazenamento = multer.diskStorage({
  destination(req, _file, cb) {
    // Organiza por ano/mes: facilita expurgo por retencao e evita
    // milhares de arquivos numa pasta so.
    const agora = new Date();
    const pasta = `${agora.getUTCFullYear()}-${String(agora.getUTCMonth() + 1).padStart(2, '0')}`;
    try {
      cb(null, prepararPasta(pasta));
    } catch (err) {
      cb(err);
    }
  },
  filename(req, file, cb) {
    // Nome imprevisivel: impede que alguem adivinhe a URL de outra foto.
    // O vinculo com o usuario fica no banco e na auditoria, nao no nome.
    const aleatorio = crypto.randomBytes(16).toString('hex');
    const extensao =
      EXTENSAO_POR_TIPO[file.mimetype] ||
      path.extname(file.originalname || '').toLowerCase() ||
      '.jpg';
    cb(null, `${Date.now()}-${aleatorio}${extensao}`);
  },
});

// Extensoes aceitas quando o cliente nao declara o tipo.
const EXTENSOES_PERMITIDAS = new Set(['.jpg', '.jpeg', '.png', '.webp']);

function filtrarTipo(_req, file, cb) {
  if (TIPOS_PERMITIDOS.has(file.mimetype)) return cb(null, true);

  // Alguns clientes enviam "application/octet-stream" por nao deduzirem o
  // tipo. Nesse caso aceitamos pela extensao - continua sendo uma
  // verificacao, so que pela outra pista disponivel.
  const extensao = path.extname(file.originalname || '').toLowerCase();
  if (file.mimetype === 'application/octet-stream' && EXTENSOES_PERMITIDAS.has(extensao)) {
    return cb(null, true);
  }

  return cb(
    new AppError(
      400,
      `Formato nao aceito: ${file.mimetype}. Envie JPEG, PNG ou WebP.`,
      'FORMATO_INVALIDO',
    ),
  );
}

const upload = multer({
  storage: armazenamento,
  fileFilter: filtrarTipo,
  limits: {
    fileSize: TAMANHO_MAXIMO_MB * 1024 * 1024,
    files: 1,
  },
});

/**
 * Traduz os erros do multer para o formato padrao da API.
 * Sem isso, arquivo grande demais viraria um 500 generico.
 */
function tratarErroUpload(err, _req, _res, next) {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return next(
        new AppError(
          413,
          `Arquivo maior que o limite de ${TAMANHO_MAXIMO_MB} MB.`,
          'ARQUIVO_GRANDE',
        ),
      );
    }
    return next(new AppError(400, `Falha no envio: ${err.message}`, 'UPLOAD_INVALIDO'));
  }
  return next(err);
}

module.exports = {
  upload,
  tratarErroUpload,
  PASTA_UPLOADS,
  TAMANHO_MAXIMO_MB,
  TIPOS_PERMITIDOS,
};
