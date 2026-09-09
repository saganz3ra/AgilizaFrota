/// Erro vindo da API ou da rede, ja traduzido para o usuario.
///
/// O backend responde os erros sempre no mesmo formato
/// (`{ erro, codigo, detalhes? }`, ver `middlewares/errorHandler.js`), o que
/// permite ao app reagir pelo CODIGO em vez de comparar textos.
class ApiExcecao implements Exception {
  /// Mensagem pronta para exibir ao motorista.
  final String mensagem;

  /// Codigo de negocio do backend (ex.: TURNO_JA_ABERTO, ULTIMO_CENTRAL).
  final String codigo;

  /// Status HTTP; 0 quando a requisicao nem chegou ao servidor.
  final int status;

  /// Detalhes de validacao (Zod), quando houver.
  final Object? detalhes;

  const ApiExcecao({
    required this.mensagem,
    required this.codigo,
    required this.status,
    this.detalhes,
  });

  /// Falha de rede: o aparelho nao alcancou o servidor.
  ///
  /// E o caso que dispara a fila offline (RNF03): nao e erro do motorista,
  /// e ausencia de sinal.
  factory ApiExcecao.semConexao([String? detalhe]) => ApiExcecao(
        mensagem: detalhe ??
            'Sem conexao com o servidor. O registro sera enviado quando a rede voltar.',
        codigo: 'SEM_CONEXAO',
        status: 0,
      );

  /// True quando o problema foi de rede, e nao uma recusa do servidor.
  bool get ehFalhaDeRede => status == 0;

  /// True quando a sessao expirou e o motorista precisa entrar de novo.
  bool get exigeNovoLogin =>
      status == 401 || codigo == 'TOKEN_INVALIDO' || codigo == 'TOKEN_AUSENTE';

  @override
  String toString() => 'ApiExcecao($status/$codigo): $mensagem';
}
