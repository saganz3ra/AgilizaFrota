import 'package:uuid/uuid.dart';

import '../../core/api/api_cliente.dart';

/// Chamadas do ciclo de atendimento (RF09).
///
/// O ciclo tem quatro marcos, e a ordem e imposta pelo backend:
///   a_caminho -> no_local -> em_transporte -> concluido
///
/// Cada marco registra HORARIO e, quando faz sentido, QUILOMETRAGEM. Sao
/// esses pares que alimentam as metricas do RNF09 (tempo de resposta,
/// tempo no local, distancia percorrida) e, mais adiante, os relatorios
/// de desempenho.
class AtendimentoServico {
  final ApiCliente api;

  const AtendimentoServico(this.api);

  /// Inicia o atendimento de um chamado acionado.
  ///
  /// Como no turno, o id vem do aparelho: se a resposta se perder, repetir
  /// a chamada devolve o mesmo atendimento em vez de criar outro (RNF03).
  Future<Map<String, dynamic>> iniciar({
    required String chamadoId,
    required int kmSaida,
    String? idLocal,
    DateTime? em,
  }) async {
    final resposta = await api.post('/atendimentos', {
      'id': idLocal ?? const Uuid().v4(),
      'chamado_id': chamadoId,
      'km_saida': kmSaida,
      'inicio_em': _instante(em),
    });
    return (resposta as Map).cast<String, dynamic>();
  }

  /// Marco 2: o veiculo chegou ao local da ocorrencia.
  Future<Map<String, dynamic>> chegadaLocal({
    required String atendimentoId,
    required int kmLocal,
    DateTime? em,
  }) async {
    final resposta = await api.patch('/atendimentos/$atendimentoId/chegada-local', {
      'km_local': kmLocal,
      'em': _instante(em),
    });
    return (resposta as Map).cast<String, dynamic>();
  }

  /// Marco 3: paciente embarcado, transporte iniciado.
  ///
  /// Nao pede nenhum dado - so o horario, que o app preenche sozinho.
  /// E o momento de maior pressa do atendimento (RNF11).
  Future<Map<String, dynamic>> iniciarTransporte({
    required String atendimentoId,
    DateTime? em,
  }) async {
    final resposta = await api.patch(
      '/atendimentos/$atendimentoId/inicio-transporte',
      {'em': _instante(em)},
    );
    return (resposta as Map).cast<String, dynamic>();
  }

  /// Marco 4: chegada ao destino e fechamento das metricas.
  Future<Map<String, dynamic>> concluir({
    required String atendimentoId,
    required int kmFinal,
    String? observacoes,
    DateTime? em,
  }) async {
    final resposta = await api.patch('/atendimentos/$atendimentoId/concluir', {
      'km_final': kmFinal,
      'em': _instante(em),
      if (observacoes != null && observacoes.trim().isNotEmpty)
        'observacoes': observacoes.trim(),
    });
    return (resposta as Map).cast<String, dynamic>();
  }

  /// Cancelamento, quando o chamado se resolve sem transporte.
  Future<Map<String, dynamic>> cancelar({
    required String atendimentoId,
    String? motivo,
  }) async {
    final resposta = await api.patch('/atendimentos/$atendimentoId/cancelar', {
      if (motivo != null && motivo.trim().isNotEmpty) 'motivo': motivo.trim(),
    });
    return (resposta as Map).cast<String, dynamic>();
  }

  /// Detalhe do atendimento, com as metricas ja calculadas.
  Future<Map<String, dynamic>> obter(String atendimentoId) async {
    final resposta = await api.get('/atendimentos/$atendimentoId');
    return (resposta as Map).cast<String, dynamic>();
  }

  /// Horario do EVENTO, do relogio do aparelho, sempre em UTC.
  ///
  /// Separado do horario de gravacao do servidor: se o registro ficar na
  /// fila por falta de sinal, o relatorio precisa mostrar quando o fato
  /// aconteceu, nao quando a internet voltou (RNF03/RNF09).
  String _instante(DateTime? em) =>
      (em ?? DateTime.now()).toUtc().toIso8601String();
}
