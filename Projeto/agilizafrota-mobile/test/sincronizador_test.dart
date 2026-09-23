// Invariante central do modo offline (decisão 3.5):
//   - falha de REDE  -> registro cai na fila e reenvia depois;
//   - recusa do SERVIDOR (validação/conflito) -> propaga o erro, NÃO enfileira.
// Confundir os dois encheria a fila de registros que nunca passariam.

import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:agilizafrota_mobile/core/api/api_cliente.dart';
import 'package:agilizafrota_mobile/core/api/api_excecao.dart';
import 'package:agilizafrota_mobile/core/offline/fila_offline.dart';
import 'package:agilizafrota_mobile/core/offline/item_fila.dart';
import 'package:agilizafrota_mobile/core/offline/sincronizador.dart';

/// Fila em memória: troca o SQLite e registra o que foi enfileirado, para o
/// teste inspecionar sem tocar em banco.
class _FilaFake extends FilaOffline {
  final List<ItemFila> enfileirados = [];

  @override
  Future<int> enfileirar(ItemFila item) async {
    enfileirados.add(item);
    return enfileirados.length;
  }

  @override
  Future<int> total() async => enfileirados.length;

  @override
  Future<int> comFalha() async => 0;
}

ItemFila _itemExemplo() =>
    ItemFila(tipo: 'turno_iniciar', ocorridoEm: DateTime(2026, 1, 1));

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  // O Sincronizador escuta o connectivity_plus no construtor. Calamos o canal
  // do plugin (não emitimos eventos) para o `listen` não falhar no teste.
  setUp(() {
    final messenger =
        TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger;
    messenger.setMockMethodCallHandler(
      const MethodChannel('dev.fluttercommunity.plus/connectivity_status'),
      (call) async => null,
    );
    messenger.setMockMethodCallHandler(
      const MethodChannel('dev.fluttercommunity.plus/connectivity'),
      (call) async => <String>['wifi'],
    );
  });

  Sincronizador criar(FilaOffline fila) => Sincronizador(
        api: ApiCliente(obterToken: () async => null),
        fila: fila,
      );

  group('Sincronizador.executarOuEnfileirar', () {
    test('falha de REDE cai para a fila offline', () async {
      final fila = _FilaFake();
      final sync = criar(fila);

      final r = await sync.executarOuEnfileirar(
        operacao: () async => throw ApiExcecao.semConexao(),
        aoEnfileirar: _itemExemplo,
      );

      expect(r.enfileirado, isTrue);
      expect(fila.enfileirados, hasLength(1));
    });

    test('recusa do servidor propaga o erro e NÃO enfileira', () async {
      final fila = _FilaFake();
      final sync = criar(fila);

      await expectLater(
        sync.executarOuEnfileirar(
          operacao: () async => throw ApiExcecao(
            mensagem: 'Quilometragem inválida',
            codigo: 'KM_INVALIDA',
            status: 400,
          ),
          aoEnfileirar: _itemExemplo,
        ),
        throwsA(isA<ApiExcecao>()),
      );

      expect(fila.enfileirados, isEmpty);
    });

    test('sucesso online devolve a resposta e não toca a fila', () async {
      final fila = _FilaFake();
      final sync = criar(fila);

      final r = await sync.executarOuEnfileirar(
        operacao: () async => {'ok': true},
        aoEnfileirar: _itemExemplo,
      );

      expect(r.enfileirado, isFalse);
      expect(r.resposta, {'ok': true});
      expect(fila.enfileirados, isEmpty);
    });
  });
}
