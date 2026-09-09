import 'dart:convert';
import 'dart:io';

import 'package:http/http.dart' as http;
import 'package:http_parser/http_parser.dart';
import 'package:image_picker/image_picker.dart';

import '../api/api_excecao.dart';
import '../config/ambiente.dart';

/// Captura e envio das evidencias fotograficas (RF03).
///
/// DECISAO DE PROJETO: a foto vai para o NOSSO backend, nao para um
/// servico de terceiros. Duas razoes:
///
///  1. LGPD - a foto do painel pode capturar o interior do veiculo e,
///     eventualmente, pessoas. Manter a imagem na infraestrutura da
///     instituicao evita compartilhar dado pessoal com um operador
///     externo sem necessidade.
///  2. Autonomia - nao amarra o sistema a um plano pago de nuvem.
///
/// O custo e que a imagem trafega pela API. Por isso comprimimos antes de
/// enviar: o que importa e o hodometro estar legivel, nao a qualidade
/// fotografica.
class Armazenamento {
  /// Devolve o token do Firebase para autenticar o envio.
  final Future<String?> Function() obterToken;

  final ImagePicker _seletor;
  final http.Client _http;

  Armazenamento({
    required this.obterToken,
    ImagePicker? seletor,
    http.Client? clienteHttp,
  })  : _seletor = seletor ?? ImagePicker(),
        _http = clienteHttp ?? http.Client();

  /// Abre a camera para fotografar o painel do veiculo.
  Future<File?> fotografarPainel() async {
    final foto = await _seletor.pickImage(
      source: ImageSource.camera,
      maxWidth: 1280,
      imageQuality: 70,
      preferredCameraDevice: CameraDevice.rear,
    );
    return foto == null ? null : File(foto.path);
  }

  /// Permite escolher da galeria.
  ///
  /// Existe para o emulador, onde nao ha camera real, e como saida quando
  /// o motorista fotografou pelo app da camera do aparelho.
  Future<File?> escolherDaGaleria() async {
    final foto = await _seletor.pickImage(
      source: ImageSource.gallery,
      maxWidth: 1280,
      imageQuality: 70,
    );
    return foto == null ? null : File(foto.path);
  }

  /// Tipo MIME a partir da extensao do arquivo.
  ///
  /// O `MultipartFile` do Dart nao deduz isso sozinho: sem informar, ele
  /// envia `application/octet-stream` e o servidor recusa - com razao,
  /// porque nao teria como distinguir uma imagem de um executavel.
  MediaType _tipoDoArquivo(String caminho) {
    final extensao = caminho.toLowerCase().split('.').last;
    switch (extensao) {
      case 'png':
        return MediaType('image', 'png');
      case 'webp':
        return MediaType('image', 'webp');
      case 'jpg':
      case 'jpeg':
      default:
        // O image_picker entrega JPEG por padrao apos a compressao.
        return MediaType('image', 'jpeg');
    }
  }

  /// Envia a imagem e devolve a URL publica gravada no turno.
  Future<String> enviarFoto(File arquivo) async {
    final token = await obterToken();
    if (token == null) {
      throw const ApiExcecao(
        mensagem: 'Sessao expirada. Entre novamente.',
        codigo: 'TOKEN_AUSENTE',
        status: 401,
      );
    }

    final requisicao = http.MultipartRequest(
      'POST',
      Uri.parse('${Ambiente.apiUrl}/upload'),
    )
      ..headers['Authorization'] = 'Bearer $token'
      ..files.add(await http.MultipartFile.fromPath(
        'arquivo',
        arquivo.path,
        contentType: _tipoDoArquivo(arquivo.path),
      ));

    http.StreamedResponse fluxo;
    try {
      // Prazo maior que o das chamadas normais: subir imagem em rede
      // movel fraca leva mais tempo que buscar um JSON.
      fluxo = await _http.send(requisicao).timeout(const Duration(seconds: 45));
    } on SocketException {
      throw ApiExcecao.semConexao(
        'Nao foi possivel enviar a foto. Verifique a conexao.',
      );
    } catch (_) {
      throw ApiExcecao.semConexao(
        'O envio da foto demorou demais. Tente novamente.',
      );
    }

    final corpo = await fluxo.stream.bytesToString();
    Map<String, dynamic> json;
    try {
      json = jsonDecode(corpo) as Map<String, dynamic>;
    } catch (_) {
      json = const {};
    }

    if (fluxo.statusCode >= 200 && fluxo.statusCode < 300) {
      final url = json['url'] as String?;
      if (url == null || url.isEmpty) {
        throw const ApiExcecao(
          mensagem: 'O servidor nao devolveu o endereco da foto.',
          codigo: 'UPLOAD_SEM_URL',
          status: 500,
        );
      }
      return url;
    }

    throw ApiExcecao(
      status: fluxo.statusCode,
      codigo: (json['codigo'] as String?) ?? 'UPLOAD_FALHOU',
      mensagem: (json['erro'] as String?) ?? 'Falha ao enviar a foto.',
    );
  }
}
