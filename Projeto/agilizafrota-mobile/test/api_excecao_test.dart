// Fundamento da fila offline (decisão 3.5): distinguir falha de REDE de recusa
// do SERVIDOR. É por status == 0 que essa distinção é feita.

import 'package:flutter_test/flutter_test.dart';
import 'package:agilizafrota_mobile/core/api/api_excecao.dart';

void main() {
  group('ApiExcecao.ehFalhaDeRede', () {
    test('semConexao() é falha de rede (status 0)', () {
      final e = ApiExcecao.semConexao();
      expect(e.status, 0);
      expect(e.ehFalhaDeRede, isTrue);
    });

    test('recusa do servidor NÃO é falha de rede', () {
      final validacao = ApiExcecao(
        mensagem: 'Quilometragem inválida',
        codigo: 'KM_INVALIDA',
        status: 400,
      );
      final conflito = ApiExcecao(
        mensagem: 'Turno já aberto',
        codigo: 'TURNO_JA_ABERTO',
        status: 409,
      );
      expect(validacao.ehFalhaDeRede, isFalse);
      expect(conflito.ehFalhaDeRede, isFalse);
    });
  });
}
