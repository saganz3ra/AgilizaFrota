import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:http/http.dart' as http;

import '../config/ambiente.dart';
import 'api_excecao.dart';

/// Cliente HTTP do Agiliza Frota.
///
/// Responsabilidades:
///  - anexar o ID token do Firebase em toda requisicao (RF01);
///  - decodificar JSON e traduzir o formato de erro do backend
///    (`{ erro, codigo }`) para [ApiExcecao];
///  - distinguir FALHA DE REDE de RECUSA DO SERVIDOR - distincao central
///    para o modo offline: sem rede o registro vai para a fila local; se o
///    servidor recusou, reenviar nao adianta e o motorista precisa saber.
class ApiCliente {
  /// Funcao que devolve o token atual. Injetada para nao acoplar o cliente
  /// ao Firebase (facilita teste e troca de provedor de autenticacao).
  final Future<String?> Function() obterToken;

  /// Chamada quando o servidor responde 401: a sessao caiu e o app deve
  /// voltar para o login.
  final void Function()? aoExpirarSessao;

  final http.Client _http;

  ApiCliente({
    required this.obterToken,
    this.aoExpirarSessao,
    http.Client? clienteHttp,
  }) : _http = clienteHttp ?? http.Client();

  Uri _url(String caminho, [Map<String, dynamic>? parametros]) {
    final base = Uri.parse('${Ambiente.apiUrl}$caminho');
    if (parametros == null || parametros.isEmpty) return base;
    return base.replace(
      queryParameters: parametros.map((c, v) => MapEntry(c, '$v')),
    );
  }

  Future<Map<String, String>> _cabecalhos() async {
    final token = await obterToken();
    return {
      'Content-Type': 'application/json; charset=utf-8',
      'Accept': 'application/json',
      if (token != null) 'Authorization': 'Bearer $token',
    };
  }

  Future<dynamic> get(String caminho, {Map<String, dynamic>? parametros}) =>
      _executar(() async =>
          _http.get(_url(caminho, parametros), headers: await _cabecalhos()));

  Future<dynamic> post(String caminho, [Map<String, dynamic>? corpo]) =>
      _executar(() async => _http.post(
            _url(caminho),
            headers: await _cabecalhos(),
            body: jsonEncode(corpo ?? const {}),
          ));

  Future<dynamic> patch(String caminho, [Map<String, dynamic>? corpo]) =>
      _executar(() async => _http.patch(
            _url(caminho),
            headers: await _cabecalhos(),
            body: jsonEncode(corpo ?? const {}),
          ));

  Future<dynamic> put(String caminho, [Map<String, dynamic>? corpo]) =>
      _executar(() async => _http.put(
            _url(caminho),
            headers: await _cabecalhos(),
            body: jsonEncode(corpo ?? const {}),
          ));

  /// Envolve a chamada: aplica timeout, converte falhas de rede e
  /// interpreta a resposta.
  Future<dynamic> _executar(Future<http.Response> Function() requisicao) async {
    http.Response resposta;
    try {
      resposta = await requisicao().timeout(Ambiente.timeout);
    } on SocketException {
      throw ApiExcecao.semConexao();
    } on TimeoutException {
      throw ApiExcecao.semConexao(
        'O servidor demorou a responder. Verifique a conexao.',
      );
    } on http.ClientException catch (e) {
      throw ApiExcecao.semConexao('Falha de rede: ${e.message}');
    }
    return _interpretar(resposta);
  }

  dynamic _interpretar(http.Response resposta) {
    // O corpo pode vir vazio (204) ou nao ser JSON (erro de proxy).
    dynamic corpo;
    if (resposta.body.isNotEmpty) {
      try {
        corpo = jsonDecode(utf8.decode(resposta.bodyBytes));
      } catch (_) {
        corpo = null;
      }
    }

    if (resposta.statusCode >= 200 && resposta.statusCode < 300) {
      return corpo;
    }

    if (resposta.statusCode == 401) {
      aoExpirarSessao?.call();
    }

    final mapa = corpo is Map<String, dynamic> ? corpo : const {};
    throw ApiExcecao(
      status: resposta.statusCode,
      codigo: (mapa['codigo'] as String?) ?? 'ERRO_${resposta.statusCode}',
      mensagem: (mapa['erro'] as String?) ?? _mensagemPadrao(resposta.statusCode),
      detalhes: mapa['detalhes'],
    );
  }

  /// Traducao amigavel para os casos em que o servidor nao mandou mensagem.
  String _mensagemPadrao(int status) {
    switch (status) {
      case 400:
        return 'Dados invalidos. Confira o que foi preenchido.';
      case 403:
        return 'Voce nao tem permissao para esta acao.';
      case 404:
        return 'Registro nao encontrado.';
      case 409:
        return 'Esta acao conflita com o estado atual do sistema.';
      case 429:
        return 'Muitas tentativas. Aguarde alguns instantes.';
      case 503:
        return 'Servico temporariamente indisponivel.';
      default:
        return status >= 500
            ? 'Erro no servidor. Tente novamente em instantes.'
            : 'Nao foi possivel completar a operacao.';
    }
  }

  void encerrar() => _http.close();
}
