import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';

import '../../core/api/api_excecao.dart';
import '../../core/auth/auth_servico.dart';
import '../../core/offline/item_fila.dart';
import '../../core/offline/sincronizador.dart';
import '../../core/tema/cores.dart';
import '../../core/tema/tema.dart';
import '../../core/widgets/aviso.dart';
import '../painel/painel_modelo.dart';
import 'package:uuid/uuid.dart';

import 'atendimento_servico.dart';

/// Ciclo de atendimento (RF09).
///
/// Uma tela so para todo o ciclo, em vez de uma por marco. O motorista
/// acompanha a linha do tempo do que ja registrou e ve um unico botao
/// grande do que fazer agora - o mesmo principio do painel (RNF11).
///
/// A quilometragem vem sempre sugerida a partir do que o sistema conhece;
/// digitar numero de hodometro com o veiculo em movimento e a principal
/// fonte de erro no registro em papel que este projeto veio substituir.
class AtendimentoPagina extends StatefulWidget {
  /// Atendimento em andamento, quando ja existe.
  final AtendimentoResumo? atendimento;

  /// Chamado acionado, usado quando o atendimento ainda vai comecar.
  final ChamadoResumo? atribuicao;

  /// Veiculo do turno, de onde sai a quilometragem sugerida.
  final VeiculoResumo veiculo;

  const AtendimentoPagina({
    super.key,
    required this.veiculo,
    this.atendimento,
    this.atribuicao,
  });

  @override
  State<AtendimentoPagina> createState() => _AtendimentoPaginaState();
}

class _AtendimentoPaginaState extends State<AtendimentoPagina> {
  late String? _atendimentoId = widget.atendimento?.id;
  late String _status = widget.atendimento?.status ?? 'nao_iniciado';

  bool _enviando = false;
  String? _erro;

  /// True quando o ultimo marco ficou guardado no aparelho.
  bool _offline = false;

  /// Marca se algo chegou a ser gravado, para o painel saber que precisa
  /// recarregar mesmo que o motorista saia no meio do ciclo.
  bool _houveMudanca = false;

  AtendimentoServico get _servico =>
      AtendimentoServico(context.read<AuthServico>().api);

  Sincronizador get _sinc => context.read<Sincronizador>();

  ChamadoResumo get _chamado =>
      widget.atendimento?.chamado ?? widget.atribuicao!;

  /// Etapas na ordem em que acontecem.
  static const _etapas = [
    ('nao_iniciado', 'Acionado', Icons.notifications_active_outlined),
    ('a_caminho', 'A caminho', Icons.directions_car_outlined),
    ('no_local', 'No local', Icons.place_outlined),
    ('em_transporte', 'Em transporte', Icons.airline_seat_flat_outlined),
    ('concluido', 'Concluido', Icons.check_circle_outline),
  ];

  int get _indiceAtual =>
      _etapas.indexWhere((e) => e.$1 == _status).clamp(0, _etapas.length - 1);

  @override
  Widget build(BuildContext context) {
    return PopScope(
      // Devolve ao painel se algo mudou, para ele recarregar.
      canPop: false,
      onPopInvokedWithResult: (jaSaiu, _) {
        if (!jaSaiu) Navigator.pop(context, _houveMudanca);
      },
      child: Scaffold(
        appBar: AppBar(title: const Text('Atendimento')),
        body: ListView(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
          children: [
            if (_erro != null) ...[
              Aviso(mensagem: _erro!),
              const SizedBox(height: 16),
            ],
            if (_offline) ...[
              const Aviso(
                mensagem: 'Sem conexao: o registro ficou guardado no '
                    'aparelho e sera enviado quando a rede voltar.',
                icone: Icons.cloud_off,
                ehErro: false,
              ),
              const SizedBox(height: 16),
            ],
            _CartaoOcorrencia(chamado: _chamado),
            const SizedBox(height: 20),
            _LinhaDoTempo(etapas: _etapas, indiceAtual: _indiceAtual),
            const SizedBox(height: 20),
            if (_status != 'concluido' && _status != 'cancelado')
              TextButton.icon(
                onPressed: _enviando ? null : _cancelar,
                icon: const Icon(Icons.block, size: 20),
                label: const Text('Cancelar atendimento'),
                style: TextButton.styleFrom(
                  foregroundColor: Cores.prioridadeCritica,
                ),
              ),
          ],
        ),
        bottomNavigationBar: _barraAcao(),
      ),
    );
  }

  Widget? _barraAcao() {
    final acao = _acaoAtual();
    if (acao == null) return null;

    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: SizedBox(
          height: TemaApp.alturaToque,
          child: ElevatedButton(
            onPressed: _enviando ? null : acao.$2,
            child: _enviando
                ? const SizedBox(
                    height: 22,
                    width: 22,
                    child: CircularProgressIndicator(
                      strokeWidth: 2.5,
                      color: Cores.marcaContraste,
                    ),
                  )
                : Text(acao.$1),
          ),
        ),
      ),
    );
  }

  /// Rotulo e acao do proximo marco, conforme o status atual.
  (String, VoidCallback)? _acaoAtual() {
    switch (_status) {
      case 'nao_iniciado':
        return ('Iniciar atendimento', _iniciar);
      case 'a_caminho':
        return ('Cheguei ao local', _chegadaLocal);
      case 'no_local':
        return ('Iniciar transporte', _iniciarTransporte);
      case 'em_transporte':
        return ('Concluir atendimento', _concluir);
      default:
        return null;
    }
  }

  // ---------------------------------------------------------------- marcos

  Future<void> _iniciar() async {
    final km = await _pedirQuilometragem(
      titulo: 'Iniciar atendimento',
      explicacao: 'Confirme a quilometragem no momento da saida.',
      rotulo: 'Km de saida',
    );
    if (km == null) return;

    // O id nasce aqui, no aparelho. Assim o atendimento tem identidade
    // mesmo que o registro fique na fila - e os marcos seguintes ja sabem
    // a que atendimento se referem, sem esperar resposta do servidor.
    final idLocal = const Uuid().v4();
    final momento = DateTime.now();

    await _executar(() async {
      final r = await _sinc.executarOuEnfileirar(
        operacao: () => _servico.iniciar(
          chamadoId: _chamado.chamadoId,
          kmSaida: km,
          idLocal: idLocal,
          em: momento,
        ),
        aoEnfileirar: () => ItemFila(
          tipo: 'atendimento_iniciar',
          ocorridoEm: momento,
          dados: {
            'id': idLocal,
            'chamado_id': _chamado.chamadoId,
            'km_saida': km,
            'inicio_em': momento.toUtc().toIso8601String(),
          },
        ),
      );
      _atendimentoId = idLocal;
      _status = 'a_caminho';
      _offline = r.enfileirado;
    });
  }

  Future<void> _chegadaLocal() async {
    final km = await _pedirQuilometragem(
      titulo: 'Chegada ao local',
      explicacao: 'Confirme a quilometragem ao chegar na ocorrencia.',
      rotulo: 'Km no local',
    );
    if (km == null) return;

    final momento = DateTime.now();
    await _executar(() async {
      final r = await _sinc.executarOuEnfileirar(
        operacao: () => _servico.chegadaLocal(
          atendimentoId: _atendimentoId!,
          kmLocal: km,
          em: momento,
        ),
        aoEnfileirar: () => ItemFila(
          tipo: 'atendimento_marco',
          marco: 'chegada_local',
          ocorridoEm: momento,
          params: {'id': _atendimentoId!},
          dados: {'km_local': km, 'em': momento.toUtc().toIso8601String()},
        ),
      );
      _status = 'no_local';
      _offline = r.enfileirado;
    });
  }

  /// Um toque, sem formulario: e o momento de maior pressa (RNF11).
  Future<void> _iniciarTransporte() async {
    final momento = DateTime.now();
    await _executar(() async {
      final r = await _sinc.executarOuEnfileirar(
        operacao: () => _servico.iniciarTransporte(
          atendimentoId: _atendimentoId!,
          em: momento,
        ),
        aoEnfileirar: () => ItemFila(
          tipo: 'atendimento_marco',
          marco: 'inicio_transporte',
          ocorridoEm: momento,
          params: {'id': _atendimentoId!},
          dados: {'em': momento.toUtc().toIso8601String()},
        ),
      );
      _status = 'em_transporte';
      _offline = r.enfileirado;
    });
  }

  Future<void> _concluir() async {
    final resultado = await _pedirConclusao();
    if (resultado == null) return;

    final momento = DateTime.now();
    await _executar(() async {
      final r = await _sinc.executarOuEnfileirar(
        operacao: () => _servico.concluir(
          atendimentoId: _atendimentoId!,
          kmFinal: resultado.$1,
          observacoes: resultado.$2,
          em: momento,
        ),
        aoEnfileirar: () => ItemFila(
          tipo: 'atendimento_marco',
          marco: 'concluir',
          ocorridoEm: momento,
          params: {'id': _atendimentoId!},
          dados: {
            'km_final': resultado.$1,
            'em': momento.toUtc().toIso8601String(),
            if ((resultado.$2 ?? '').trim().isNotEmpty)
              'observacoes': resultado.$2!.trim(),
          },
        ),
      );
      _status = 'concluido';
      _offline = r.enfileirado;
    });

    if (mounted && _status == 'concluido') {
      Navigator.pop(context, true);
    }
  }

  Future<void> _cancelar() async {
    final motivo = await _pedirMotivo();
    if (motivo == null) return;

    // Antes de iniciar nao ha atendimento no servidor: nada a cancelar.
    if (_atendimentoId == null) {
      if (mounted) Navigator.pop(context, false);
      return;
    }

    await _executar(() async {
      await _servico.cancelar(atendimentoId: _atendimentoId!, motivo: motivo);
      _status = 'cancelado';
    });

    if (mounted && _status == 'cancelado') {
      Navigator.pop(context, true);
    }
  }

  /// Envolve cada marco: trava o botao, trata o erro e marca a mudanca.
  Future<void> _executar(Future<void> Function() acao) async {
    setState(() {
      _enviando = true;
      _erro = null;
    });
    try {
      await acao();
      _houveMudanca = true;
      if (mounted) setState(() => _enviando = false);
    } on ApiExcecao catch (e) {
      if (!mounted) return;
      setState(() {
        _enviando = false;
        _erro = e.mensagem;
      });
    }
  }

  // ------------------------------------------------------------ formularios

  Future<int?> _pedirQuilometragem({
    required String titulo,
    required String explicacao,
    required String rotulo,
  }) {
    final controlador = TextEditingController(
      text: widget.veiculo.quilometragemAtual.toString(),
    );

    return showDialog<int>(
      context: context,
      builder: (d) => AlertDialog(
        title: Text(titulo),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              explicacao,
              style: const TextStyle(fontSize: 15, color: Cores.conteudoSuave),
            ),
            const SizedBox(height: 16),
            TextField(
              controller: controlador,
              autofocus: true,
              keyboardType: TextInputType.number,
              inputFormatters: [FilteringTextInputFormatter.digitsOnly],
              style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w600),
              decoration: InputDecoration(
                labelText: rotulo,
                helperText: 'Ultimo registro: '
                    '${widget.veiculo.quilometragemAtual} km',
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(d),
            child: const Text('Cancelar'),
          ),
          TextButton(
            onPressed: () {
              final valor = int.tryParse(controlador.text.trim());
              if (valor != null) Navigator.pop(d, valor);
            },
            child: const Text('Confirmar'),
          ),
        ],
      ),
    );
  }

  Future<(int, String?)?> _pedirConclusao() {
    final km = TextEditingController(
      text: widget.veiculo.quilometragemAtual.toString(),
    );
    final observacoes = TextEditingController();

    return showDialog<(int, String?)>(
      context: context,
      builder: (d) => AlertDialog(
        title: const Text('Concluir atendimento'),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'A recepcao do destino ja foi avisada automaticamente na '
                'chegada.',
                style: TextStyle(fontSize: 14, color: Cores.conteudoSuave),
              ),
              const SizedBox(height: 16),
              TextField(
                controller: km,
                autofocus: true,
                keyboardType: TextInputType.number,
                inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                style:
                    const TextStyle(fontSize: 22, fontWeight: FontWeight.w600),
                decoration: const InputDecoration(labelText: 'Km final'),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: observacoes,
                minLines: 2,
                maxLines: 4,
                maxLength: 2000,
                decoration: const InputDecoration(
                  labelText: 'Observacoes (opcional)',
                  counterText: '',
                ),
              ),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(d),
            child: const Text('Voltar'),
          ),
          TextButton(
            onPressed: () {
              final valor = int.tryParse(km.text.trim());
              if (valor != null) {
                Navigator.pop(d, (valor, observacoes.text));
              }
            },
            child: const Text('Concluir'),
          ),
        ],
      ),
    );
  }

  Future<String?> _pedirMotivo() {
    final motivo = TextEditingController();
    return showDialog<String>(
      context: context,
      builder: (d) => AlertDialog(
        title: const Text('Cancelar atendimento'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Use quando a ocorrencia se resolver sem transporte. '
              'O chamado volta para a Central.',
              style: TextStyle(fontSize: 15, color: Cores.conteudoSuave),
            ),
            const SizedBox(height: 16),
            TextField(
              controller: motivo,
              autofocus: true,
              maxLength: 300,
              minLines: 2,
              maxLines: 3,
              decoration: const InputDecoration(
                labelText: 'Motivo',
                counterText: '',
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(d),
            child: const Text('Voltar'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(d, motivo.text),
            style: TextButton.styleFrom(
              foregroundColor: Cores.prioridadeCritica,
            ),
            child: const Text('Cancelar atendimento'),
          ),
        ],
      ),
    );
  }
}

/// Dados da ocorrencia, sempre visiveis durante o ciclo.
class _CartaoOcorrencia extends StatelessWidget {
  final ChamadoResumo chamado;

  const _CartaoOcorrencia({required this.chamado});

  @override
  Widget build(BuildContext context) {
    final cor = Cores.daPrioridade(chamado.prioridade);

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                  decoration: BoxDecoration(
                    color: cor.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(6),
                    border: Border.all(color: cor.withValues(alpha: 0.4)),
                  ),
                  child: Text(
                    chamado.prioridade.toUpperCase(),
                    style: TextStyle(
                      color: cor,
                      fontSize: 12,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
                if (chamado.ehEmergencia) ...[
                  const SizedBox(width: 8),
                  const Text(
                    'EMERGENCIA',
                    style: TextStyle(
                      color: Cores.prioridadeCritica,
                      fontSize: 12,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ],
              ],
            ),
            const SizedBox(height: 12),
            Text(
              chamado.natureza,
              style: const TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.w700,
                color: Cores.conteudo,
              ),
            ),
            if (chamado.origemEndereco != null) ...[
              const SizedBox(height: 12),
              _Linha(
                icone: Icons.place_outlined,
                rotulo: 'Ocorrencia',
                valor: chamado.origemEndereco!,
              ),
            ],
            if (chamado.destinoNome != null) ...[
              const SizedBox(height: 8),
              _Linha(
                icone: Icons.local_hospital_outlined,
                rotulo: 'Destino',
                valor: chamado.destinoNome!,
              ),
            ],
          ],
        ),
      ),
    );
  }
}

/// Linha do tempo dos marcos ja registrados.
class _LinhaDoTempo extends StatelessWidget {
  final List<(String, String, IconData)> etapas;
  final int indiceAtual;

  const _LinhaDoTempo({required this.etapas, required this.indiceAtual});

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Andamento',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.w700,
                color: Cores.conteudo,
              ),
            ),
            const SizedBox(height: 16),
            for (var i = 0; i < etapas.length; i++)
              _Etapa(
                rotulo: etapas[i].$2,
                icone: etapas[i].$3,
                concluida: i < indiceAtual,
                atual: i == indiceAtual,
                ultima: i == etapas.length - 1,
              ),
          ],
        ),
      ),
    );
  }
}

class _Etapa extends StatelessWidget {
  final String rotulo;
  final IconData icone;
  final bool concluida;
  final bool atual;
  final bool ultima;

  const _Etapa({
    required this.rotulo,
    required this.icone,
    required this.concluida,
    required this.atual,
    required this.ultima,
  });

  @override
  Widget build(BuildContext context) {
    final ativa = concluida || atual;
    final cor = concluida
        ? Cores.statusDisponivel
        : atual
            ? Cores.marca
            : Cores.borda;

    return IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Column(
            children: [
              Container(
                height: 32,
                width: 32,
                decoration: BoxDecoration(
                  color: ativa ? cor : Cores.superficie,
                  shape: BoxShape.circle,
                  border: Border.all(color: cor, width: 2),
                ),
                child: Icon(
                  concluida ? Icons.check : icone,
                  size: 18,
                  color: ativa ? Cores.marcaContraste : Cores.conteudoSuave,
                ),
              ),
              if (!ultima)
                Expanded(
                  child: Container(
                    width: 2,
                    color: concluida ? Cores.statusDisponivel : Cores.borda,
                  ),
                ),
            ],
          ),
          const SizedBox(width: 12),
          Padding(
            padding: EdgeInsets.only(top: 5, bottom: ultima ? 0 : 20),
            child: Text(
              rotulo,
              style: TextStyle(
                fontSize: 16,
                fontWeight: atual ? FontWeight.w700 : FontWeight.w500,
                color: ativa ? Cores.conteudo : Cores.conteudoSuave,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _Linha extends StatelessWidget {
  final IconData icone;
  final String rotulo;
  final String valor;

  const _Linha({
    required this.icone,
    required this.rotulo,
    required this.valor,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(icone, size: 20, color: Cores.conteudoSuave),
        const SizedBox(width: 10),
        Text(
          '$rotulo: ',
          style: const TextStyle(fontSize: 15, color: Cores.conteudoSuave),
        ),
        Expanded(
          child: Text(
            valor,
            style: const TextStyle(
              fontSize: 15,
              color: Cores.conteudo,
              fontWeight: FontWeight.w500,
            ),
          ),
        ),
      ],
    );
  }
}
