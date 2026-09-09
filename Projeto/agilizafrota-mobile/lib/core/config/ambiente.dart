/// Configuracao de ambiente do aplicativo.
///
/// O celular NAO enxerga "localhost": esse endereco aponta para o proprio
/// aparelho. Por isso a URL base usa o IP da maquina onde a API roda, na
/// mesma rede Wi-Fi. Em producao isso vira um dominio com HTTPS.
///
/// O valor pode ser trocado sem recompilar o codigo, via:
///   flutter run --dart-define=API_URL=http://192.168.1.50:3000/api
class Ambiente {
  const Ambiente._();

  /// URL base da API do Agiliza Frota.
  static const String apiUrl = String.fromEnvironment(
    'API_URL',
    defaultValue: 'http://192.168.1.9:3000/api',
  );

  /// Tempo maximo de espera por uma resposta da API.
  ///
  /// Curto de proposito: o motorista usa o app em situacao de urgencia e
  /// precisa saber rapido que esta sem conexao, para o registro cair na
  /// fila offline em vez de travar a tela (RNF03/RNF04).
  static const Duration timeout = Duration(seconds: 12);

  /// Indica se estamos apontando para um servidor local de desenvolvimento.
  static bool get ehDesenvolvimento => apiUrl.startsWith('http://');
}
