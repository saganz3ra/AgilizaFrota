import 'dart:async';

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter/foundation.dart';

import '../api/api_cliente.dart';
import '../api/api_excecao.dart';
import 'fila_offline.dart';
import 'item_fila.dart';

/// Resultado de uma operacao que pode ter ido para a fila.
class ResultadoOperacao {
  /// Corpo devolvido pelo servidor, quando a operacao foi online.
  final Map<String, dynamic>? resposta;

  /// True quando o registro ficou na fila local por falta de rede.
  final bool enfileirado;

  const ResultadoOperacao.online(this.resposta) : enfileirado = false;
  const ResultadoOperacao.offline()
      : resposta = null,
        enfileirado = true;
}

/// Sincronizacao entre a fila local e o servidor (RNF03).
///
/// Estrategia em uma frase: **tenta online, cai para a fila, reenvia
/// quando a rede voltar**.
///
/// A decisao de enfileirar considera apenas FALHA DE REDE. Se o servidor
/// respondeu recusando (quilometragem invalida, turno ja aberto, ordem de
/// marcos errada), reenviar nao resolveria nada - o motorista precisa ver
/// o erro e corrigir. Confundir os dois casos encheria a fila de registros
/// que nunca vao passar.
class Sincronizador extends ChangeNotifier {
  final ApiCliente api;
  final FilaOffline fila;

  int _pendentes = 0;
  int _comFalha = 0;
  bool _sincronizando = false;
  bool _online = true;
  String? _ultimoResultado;
  StreamSubscription<List<ConnectivityResult>>? _assinaturaRede;

  int get pendentes => _pendentes;
  int get comFalha => _comFalha;
  bool get sincronizando => _sincronizando;
  bool get online => _online;
  String? get ultimoResultado => _ultimoResultado;
  bool get temPendencias => _pendentes > 0;

  Sincronizador({required this.api, FilaOffline? fila})
      : fila = fila ?? FilaOffline() {
    _observarRede();
    atualizarContadores();
  }

  /// Quando a rede volta, tenta esvaziar a fila sozinho.
  ///
  /// E o comportamento que o motorista espera: ele dirigiu por uma area
  /// sem sinal, registrou os marcos normalmente e, ao chegar num ponto com
  /// cobertura, tudo sobe sem que ele precise lembrar de nada (RNF11).
  void _observarRede() {
    _assinaturaRede = Connectivity().onConnectivityChanged.listen((estados) {
      final tinhaRede = _online;
      _online = !estados.contains(ConnectivityResult.none);
      notifyListeners();
      if (!tinhaRede && _online && _pendentes > 0) {
        sincronizar();
      }
    });
  }

  Future<void> atualizarContadores() async {
    _pendentes = await fila.total();
    _comFalha = await fila.comFalha();
    notifyListeners();
  }

  /// Executa a operacao online; se faltar rede, guarda na fila.
  ///
  /// [aoEnfileirar] descreve a mesma operacao no formato do `POST /sync`.
  Future<ResultadoOperacao> executarOuEnfileirar({
    required Future<Map<String, dynamic>> Function() operacao,
    required ItemFila Function() aoEnfileirar,
  }) async {
    try {
      final resposta = await operacao();
      return ResultadoOperacao.online(resposta);
    } on ApiExcecao catch (e) {
      // Recusa do servidor: propaga para o motorista corrigir.
      if (!e.ehFalhaDeRede) rethrow;

      await fila.enfileirar(aoEnfileirar());
      await atualizarContadores();
      return const ResultadoOperacao.offline();
    }
  }

  /// Envia a fila inteira num unico pacote (`POST /api/sync`).
  ///
  /// Um pacote so, e nao uma requisicao por item: em rede movel instavel,
  /// cada conexao nova e uma chance de falhar. O servidor processa item a
  /// item e devolve o veredito de cada um.
  Future<bool> sincronizar() async {
    if (_sincronizando) return false;

    final itens = await fila.pendentes();
    if (itens.isEmpty) {
      _ultimoResultado = null;
      await atualizarContadores();
      return true;
    }

    _sincronizando = true;
    _ultimoResultado = null;
    notifyListeners();

    try {
      final resposta = await api.post('/sync', {
        'itens': itens.map((i) => i.paraSync()).toList(),
      });

      final corpo = (resposta as Map).cast<String, dynamic>();
      final resultados = (corpo['resultados'] as List? ?? const [])
          .map((r) => (r as Map).cast<String, dynamic>())
          .toList();

      // "aplicado" e "duplicado" saem da fila; "falha" fica, com o motivo.
      final aceitos = <int>[];
      for (final r in resultados) {
        final idLocal = int.tryParse('${r['id_local']}');
        if (idLocal == null) continue;
        if (r['resultado'] == 'falha') {
          await fila.marcarFalha(idLocal, '${r['erro'] ?? 'Falha no envio'}');
        } else {
          aceitos.add(idLocal);
        }
      }
      await fila.remover(aceitos);

      final resumo = (corpo['resumo'] as Map?)?.cast<String, dynamic>() ?? {};
      final falhas = (resumo['falhas'] as num?)?.toInt() ?? 0;
      _ultimoResultado = falhas > 0
          ? '${aceitos.length} enviado(s), $falhas com problema.'
          : '${aceitos.length} registro(s) enviado(s).';

      await atualizarContadores();
      return falhas == 0;
    } on ApiExcecao catch (e) {
      _ultimoResultado = e.ehFalhaDeRede
          ? 'Sem conexao. Os registros continuam guardados.'
          : e.mensagem;
      return false;
    } finally {
      _sincronizando = false;
      notifyListeners();
    }
  }

  /// Descarta um item que nunca vai passar (dado invalido, por exemplo).
  Future<void> descartar(int idLocal) async {
    await fila.descartar(idLocal);
    await atualizarContadores();
  }

  Future<List<ItemFila>> listar() => fila.pendentes();

  @override
  void dispose() {
    _assinaturaRede?.cancel();
    super.dispose();
  }
}
