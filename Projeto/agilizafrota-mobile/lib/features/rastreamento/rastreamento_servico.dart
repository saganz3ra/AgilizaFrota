import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:geolocator/geolocator.dart';

import '../../core/api/api_cliente.dart';
import '../../core/api/api_excecao.dart';
import '../../core/offline/item_fila.dart';
import '../../core/offline/sincronizador.dart';

/// Situacao do rastreamento, para a interface explicar o que esta havendo.
enum SituacaoGps {
  desligado,
  semPermissao,
  servicoDesligado,
  ativo,
}

/// Rastreamento da frota em tempo real (RF11).
///
/// Regras de coleta, todas com um motivo:
///
///  - **So com turno aberto.** Fora da jornada a posicao do motorista nao
///    interessa ao sistema e seria coleta excessiva (LGPD/RNF02). O
///    rastreamento liga ao abrir o turno e desliga ao encerrar.
///
///  - **Por distancia, nao por tempo.** O filtro de 30 metros evita
///    inundar o banco com centenas de pontos identicos enquanto a
///    ambulancia espera parada num semaforo ou no patio.
///
///  - **Envio em lote, a cada 30 segundos.** Uma requisicao por ponto
///    gastaria bateria e dados sem ganho: a central nao precisa de
///    precisao de segundo, precisa saber onde o veiculo esta.
///
///  - **Sem rede, vai para a fila.** As posicoes sao o caso mais comum de
///    perda de sinal, e tambem o mais tolerante: chegam depois, com o
///    horario correto de quando foram capturadas (RNF03).
class RastreamentoServico extends ChangeNotifier {
  final ApiCliente api;
  final Sincronizador sincronizador;

  /// Distancia minima entre dois pontos guardados.
  static const int filtroDistanciaM = 30;

  /// Intervalo de envio do lote acumulado.
  static const Duration intervaloEnvio = Duration(seconds: 30);

  SituacaoGps _situacao = SituacaoGps.desligado;
  Position? _ultima;
  int _enviadasNaSessao = 0;
  String? _erro;

  StreamSubscription<Position>? _assinatura;
  Timer? _relogio;
  final List<Map<String, dynamic>> _acumuladas = [];

  SituacaoGps get situacao => _situacao;
  Position? get ultima => _ultima;
  int get enviadasNaSessao => _enviadasNaSessao;
  int get aguardandoEnvio => _acumuladas.length;
  String? get erro => _erro;
  bool get ligado => _situacao == SituacaoGps.ativo;

  RastreamentoServico({required this.api, required this.sincronizador});

  /// Liga o rastreamento. Chamado quando ha turno aberto.
  Future<void> iniciar() async {
    if (_assinatura != null) return;

    final permitido = await _garantirPermissao();
    if (!permitido) {
      notifyListeners();
      return;
    }

    _assinatura = Geolocator.getPositionStream(
      locationSettings: const LocationSettings(
        accuracy: LocationAccuracy.high,
        distanceFilter: filtroDistanciaM,
      ),
    ).listen(_aoReceberPosicao, onError: (Object e) {
      _erro = 'Falha no GPS: $e';
      notifyListeners();
    });

    _relogio = Timer.periodic(intervaloEnvio, (_) => enviarAcumuladas());
    _situacao = SituacaoGps.ativo;
    _erro = null;
    notifyListeners();
  }

  /// Desliga o rastreamento e envia o que ainda estiver acumulado.
  Future<void> parar() async {
    await _assinatura?.cancel();
    _assinatura = null;
    _relogio?.cancel();
    _relogio = null;
    await enviarAcumuladas();
    _situacao = SituacaoGps.desligado;
    notifyListeners();
  }

  void _aoReceberPosicao(Position posicao) {
    _ultima = posicao;
    _acumuladas.add({
      'lat': posicao.latitude,
      'lng': posicao.longitude,
      'precisao_m': posicao.accuracy,
      // O GPS informa velocidade em m/s; a API trabalha em km/h.
      'velocidade_kmh': (posicao.speed * 3.6).clamp(0, 500).toDouble(),
      if (posicao.heading >= 0 && posicao.heading <= 360)
        'direcao_graus': posicao.heading,
      'altitude_m': posicao.altitude,
      // Horario do EVENTO: e o instante da captura, nao o do envio.
      'registrado_em': posicao.timestamp.toUtc().toIso8601String(),
    });
    notifyListeners();
  }

  /// Envia o lote acumulado; o que nao passar vai para a fila.
  Future<void> enviarAcumuladas() async {
    if (_acumuladas.isEmpty) return;

    // Copia e limpa antes de enviar: se novas posicoes chegarem durante a
    // requisicao, elas entram no proximo lote em vez de se perderem.
    final lote = List<Map<String, dynamic>>.from(_acumuladas);
    _acumuladas.clear();
    notifyListeners();

    try {
      await api.post('/posicoes/lote', {'posicoes': lote});
      _enviadasNaSessao += lote.length;
      _erro = null;
    } on ApiExcecao catch (e) {
      if (e.ehFalhaDeRede) {
        // Cada ponto vira um item da fila, com o horario da captura.
        for (final ponto in lote) {
          await sincronizador.fila.enfileirar(
            ItemFila(
              tipo: 'posicao',
              ocorridoEm: DateTime.parse(ponto['registrado_em'] as String),
              dados: ponto,
            ),
          );
        }
        await sincronizador.atualizarContadores();
      } else {
        // Recusa do servidor (turno fechado, coordenada invalida): nao
        // adianta reenviar, e posicao antiga nao tem valor operacional.
        _erro = e.mensagem;
      }
    }
    notifyListeners();
  }

  /// Pede a permissao de localizacao, explicando o estado ao chamador.
  Future<bool> _garantirPermissao() async {
    if (!await Geolocator.isLocationServiceEnabled()) {
      _situacao = SituacaoGps.servicoDesligado;
      _erro = 'A localizacao do aparelho esta desligada.';
      return false;
    }

    var permissao = await Geolocator.checkPermission();
    if (permissao == LocationPermission.denied) {
      permissao = await Geolocator.requestPermission();
    }
    if (permissao == LocationPermission.denied ||
        permissao == LocationPermission.deniedForever) {
      _situacao = SituacaoGps.semPermissao;
      _erro = 'Sem permissao de localizacao. A central nao vera o veiculo.';
      return false;
    }
    return true;
  }

  /// Texto curto do estado, para a tela inicial.
  String get resumo {
    switch (_situacao) {
      case SituacaoGps.ativo:
        return 'Rastreamento ativo';
      case SituacaoGps.semPermissao:
        return 'Sem permissao de localizacao';
      case SituacaoGps.servicoDesligado:
        return 'Localizacao desligada no aparelho';
      case SituacaoGps.desligado:
        return 'Rastreamento inativo';
    }
  }

  @override
  void dispose() {
    _assinatura?.cancel();
    _relogio?.cancel();
    super.dispose();
  }
}
