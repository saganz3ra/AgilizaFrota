import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/api/api_excecao.dart';
import '../../core/auth/auth_servico.dart';
import '../../core/offline/sincronizador.dart';
import '../../core/tema/cores.dart';
import '../../core/tema/tema.dart';
import '../../core/widgets/aviso.dart';
import '../../core/widgets/carregando.dart';
import '../atendimento/atendimento_pagina.dart';
import '../rastreamento/fila_pagina.dart';
import '../rastreamento/rastreamento_servico.dart';
import '../turno/encerrar_turno_pagina.dart';
import '../turno/iniciar_turno_pagina.dart';
import 'painel_modelo.dart';

/// Tela inicial do motorista (RNF11).
///
/// Regra de ouro desta tela: o motorista abre o app e ve UMA acao em
/// destaque - a que ele precisa fazer agora. Tudo o mais e contexto.
/// Quem decide qual e a acao e o backend (`GET /motorista/painel`), para
/// que a regra viva num lugar so e o app nao precise reimplementa-la.
class PainelPagina extends StatefulWidget {
  const PainelPagina({super.key});

  @override
  State<PainelPagina> createState() => _PainelPaginaState();
}

class _PainelPaginaState extends State<PainelPagina> {
  PainelMotorista? _painel;
  String? _erro;
  bool _carregando = true;

  @override
  void initState() {
    super.initState();
    _carregar();
  }

  Future<void> _carregar() async {
    setState(() {
      _carregando = _painel == null;
      _erro = null;
    });
    try {
      final api = context.read<AuthServico>().api;
      final resposta = await api.get('/motorista/painel');
      if (!mounted) return;
      final painel =
          PainelMotorista.doJson((resposta as Map).cast<String, dynamic>());
      setState(() {
        _painel = painel;
        _carregando = false;
      });
      _ajustarRastreamento(painel);
    } on ApiExcecao catch (e) {
      if (!mounted) return;
      setState(() {
        _erro = e.mensagem;
        _carregando = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthServico>();
    final nome = auth.usuario?.primeiroNome ?? 'Motorista';

    return Scaffold(
      appBar: AppBar(
        title: Text('Ola, $nome'),
        actions: [
          _BotaoFila(aoTocar: _abrirFila),
          IconButton(
            icon: const Icon(Icons.refresh),
            tooltip: 'Atualizar',
            onPressed: _carregar,
          ),
          IconButton(
            icon: const Icon(Icons.logout),
            tooltip: 'Sair',
            onPressed: () => _confirmarSaida(context),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _carregar,
        color: Cores.marca,
        child: _corpo(),
      ),
    );
  }

  Widget _corpo() {
    if (_carregando) {
      return const Carregando(rotulo: 'Carregando seu painel...');
    }

    final painel = _painel;

    return ListView(
      padding: const EdgeInsets.all(16),
      // physics sempre rolavel para o "puxar para atualizar" funcionar
      // mesmo com a tela quase vazia.
      physics: const AlwaysScrollableScrollPhysics(),
      children: [
        const _BarraSituacao(),

        if (_erro != null) ...[
          Aviso(mensagem: _erro!),
          const SizedBox(height: 16),
        ],

        if (painel != null) ...[
          _CartaoProximaAcao(
            acao: painel.proximaAcao,
            onPressed: () => _executarAcao(painel.proximaAcao),
          ),
          const SizedBox(height: 16),

          if (painel.atendimento != null) ...[
            InkWell(
              onTap: _abrirAtendimento,
              borderRadius: BorderRadius.circular(12),
              child: _CartaoAtendimento(atendimento: painel.atendimento!),
            ),
            const SizedBox(height: 16),
          ] else if (painel.atribuicao != null) ...[
            _CartaoChamado(chamado: painel.atribuicao!),
            const SizedBox(height: 16),
          ],

          if (painel.veiculo != null) ...[
            _CartaoVeiculo(
              veiculo: painel.veiculo!,
              turno: painel.turno,
              // So oferece encerrar quando nao ha atendimento em curso:
              // fechar o turno no meio de um transporte deixaria o
              // atendimento orfao.
              aoEncerrarTurno:
                  painel.atendimento == null ? _encerrarTurno : null,
            ),
            const SizedBox(height: 16),
          ],

          // Visivel so durante o turno: fora dele nao ha coleta.
          if (painel.temTurnoAberto) ...[
            const _CartaoRastreamento(),
            const SizedBox(height: 16),
          ],

          if (painel.notificacoesNaoLidas > 0)
            Aviso.info(
              mensagem:
                  '${painel.notificacoesNaoLidas} notificacao(oes) nao lida(s).',
              icone: Icons.notifications_active_outlined,
            ),
        ],
      ],
    );
  }

  /// Encaminha para a tela da acao sugerida pelo backend.
  ///
  /// O `switch` cobre so o que ja existe; o resto avisa em vez de falhar
  /// em silencio, para nao dar a impressao de que o toque nao funcionou.
  Future<void> _executarAcao(ProximaAcao acao) async {
    if (acao.ehEspera) return;

    switch (acao.acao) {
      case 'iniciar_turno':
        final abriu = await Navigator.push<bool>(
          context,
          MaterialPageRoute(
            builder: (_) => IniciarTurnoPagina(
              itensIniciais: _painel?.itensChecklist ?? const [],
            ),
          ),
        );
        if (abriu == true) {
          _avisar('Turno aberto. Bom trabalho!');
          await _carregar();
        }
        break;

      // Os quatro marcos do atendimento levam a mesma tela: ela sabe, pelo
      // status, qual e o proximo passo. Evita quatro rotas que fariam a
      // mesma coisa.
      case 'iniciar_atendimento':
      case 'registrar_chegada':
      case 'iniciar_transporte':
      case 'concluir_atendimento':
        await _abrirAtendimento();
        break;

      default:
        _avisar('Em breve: ${acao.rotulo}');
    }
  }

  /// Liga o GPS quando ha turno aberto e desliga quando nao ha.
  ///
  /// A regra vive aqui, num lugar so: nao dependemos de o motorista
  /// lembrar de ativar nada, e a posicao nunca e coletada fora da jornada
  /// (minimizacao de dados, RNF02).
  void _ajustarRastreamento(PainelMotorista painel) {
    final gps = context.read<RastreamentoServico>();
    if (painel.temTurnoAberto && !gps.ligado) {
      gps.iniciar();
    } else if (!painel.temTurnoAberto && gps.ligado) {
      gps.parar();
    }
  }

  Future<void> _abrirFila() async {
    await Navigator.push(
      context,
      MaterialPageRoute(builder: (_) => const FilaPagina()),
    );
  }

  Future<void> _abrirAtendimento() async {
    final painel = _painel;
    // Sem turno nao ha veiculo, e sem veiculo nao ha quilometragem para
    // sugerir. O backend tambem recusaria, mas aqui a mensagem e util.
    if (painel?.veiculo == null) {
      _avisar('Abra o turno antes de iniciar um atendimento.');
      return;
    }

    final mudou = await Navigator.push<bool>(
      context,
      MaterialPageRoute(
        builder: (_) => AtendimentoPagina(
          veiculo: painel!.veiculo!,
          atendimento: painel.atendimento,
          atribuicao: painel.atribuicao,
        ),
      ),
    );
    if (mudou == true) await _carregar();
  }

  /// Encerramento do turno.
  ///
  /// Nao vem da `proxima_acao`: enquanto o turno esta aberto, a acao em
  /// destaque e sempre o atendimento. Fechar o turno e uma decisao do
  /// motorista no fim da jornada, entao fica como acao secundaria.
  Future<void> _encerrarTurno() async {
    final painel = _painel;
    if (painel?.turno == null || painel?.veiculo == null) return;

    final encerrou = await Navigator.push<bool>(
      context,
      MaterialPageRoute(
        builder: (_) => EncerrarTurnoPagina(
          turno: painel!.turno!,
          veiculo: painel.veiculo!,
        ),
      ),
    );
    if (encerrou == true) {
      _avisar('Turno encerrado.');
      await _carregar();
    }
  }

  void _avisar(String mensagem) {
    if (!mounted) return;
    ScaffoldMessenger.of(context)
        .showSnackBar(SnackBar(content: Text(mensagem)));
  }

  Future<void> _confirmarSaida(BuildContext context) async {
    final auth = context.read<AuthServico>();
    final confirmou = await showDialog<bool>(
      context: context,
      builder: (dialogo) => AlertDialog(
        title: const Text('Sair do aplicativo?'),
        content: const Text(
          'Voce precisara entrar novamente com e-mail e senha.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogo, false),
            child: const Text('Cancelar'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(dialogo, true),
            child: const Text('Sair'),
          ),
        ],
      ),
    );
    if (confirmou == true) await auth.sair();
  }
}

/// O bloco mais importante da tela: a acao do momento.
class _CartaoProximaAcao extends StatelessWidget {
  final ProximaAcao acao;
  final VoidCallback onPressed;

  const _CartaoProximaAcao({required this.acao, required this.onPressed});

  @override
  Widget build(BuildContext context) {
    if (acao.ehEspera) {
      return Card(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            children: [
              const Icon(Icons.hourglass_empty,
                  size: 44, color: Cores.conteudoSuave),
              const SizedBox(height: 14),
              Text(
                acao.rotulo,
                style: const TextStyle(
                  fontSize: 19,
                  fontWeight: FontWeight.w600,
                  color: Cores.conteudo,
                ),
              ),
              if (acao.dica != null) ...[
                const SizedBox(height: 8),
                Text(
                  acao.dica!,
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                    fontSize: 15,
                    color: Cores.conteudoSuave,
                  ),
                ),
              ],
            ],
          ),
        ),
      );
    }

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Cores.marca,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Text(
            'PROXIMA ACAO',
            style: TextStyle(
              color: Cores.marcaContraste,
              fontSize: 12,
              fontWeight: FontWeight.w700,
              letterSpacing: 1.2,
            ),
          ),
          const SizedBox(height: 10),
          Text(
            acao.rotulo,
            style: const TextStyle(
              color: Cores.marcaContraste,
              fontSize: 26,
              fontWeight: FontWeight.w700,
            ),
          ),
          if (acao.dica != null) ...[
            const SizedBox(height: 8),
            Text(
              acao.dica!,
              style: TextStyle(
                color: Cores.marcaContraste.withValues(alpha: 0.9),
                fontSize: 15,
                height: 1.35,
              ),
            ),
          ],
          const SizedBox(height: 18),
          SizedBox(
            height: TemaApp.alturaToque,
            child: ElevatedButton(
              onPressed: onPressed,
              style: ElevatedButton.styleFrom(
                backgroundColor: Cores.marcaContraste,
                foregroundColor: Cores.marca,
              ),
              child: Text(acao.rotulo),
            ),
          ),
        ],
      ),
    );
  }
}

/// Contexto do chamado acionado pela central.
class _CartaoChamado extends StatelessWidget {
  final ChamadoResumo chamado;

  const _CartaoChamado({required this.chamado});

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                _Etiqueta(
                  texto: chamado.prioridade.toUpperCase(),
                  cor: Cores.daPrioridade(chamado.prioridade),
                ),
                const SizedBox(width: 8),
                if (chamado.ehEmergencia)
                  const _Etiqueta(
                    texto: 'EMERGENCIA',
                    cor: Cores.prioridadeCritica,
                  ),
              ],
            ),
            const SizedBox(height: 12),
            Text(
              chamado.natureza,
              style: const TextStyle(
                fontSize: 19,
                fontWeight: FontWeight.w600,
                color: Cores.conteudo,
              ),
            ),
            if (chamado.origemEndereco != null) ...[
              const SizedBox(height: 10),
              _Linha(
                icone: Icons.place_outlined,
                rotulo: 'Origem',
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

/// Atendimento em andamento, com a etapa atual em destaque.
class _CartaoAtendimento extends StatelessWidget {
  final AtendimentoResumo atendimento;

  const _CartaoAtendimento({required this.atendimento});

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                _Etiqueta(
                  texto: atendimento.etapa.toUpperCase(),
                  cor: Cores.statusEmUso,
                ),
                const SizedBox(width: 8),
                _Etiqueta(
                  texto: atendimento.chamado.prioridade.toUpperCase(),
                  cor: Cores.daPrioridade(atendimento.chamado.prioridade),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Text(
              atendimento.chamado.natureza,
              style: const TextStyle(
                fontSize: 19,
                fontWeight: FontWeight.w600,
                color: Cores.conteudo,
              ),
            ),
            if (atendimento.chamado.destinoNome != null) ...[
              const SizedBox(height: 10),
              _Linha(
                icone: Icons.local_hospital_outlined,
                rotulo: 'Destino',
                valor: atendimento.chamado.destinoNome!,
              ),
            ],
          ],
        ),
      ),
    );
  }
}

/// Veiculo e turno em andamento.
class _CartaoVeiculo extends StatelessWidget {
  final VeiculoResumo veiculo;
  final TurnoResumo? turno;
  final VoidCallback? aoEncerrarTurno;

  const _CartaoVeiculo({
    required this.veiculo,
    this.turno,
    this.aoEncerrarTurno,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Icon(Icons.directions_car_outlined,
                    color: Cores.conteudoSuave),
                const SizedBox(width: 10),
                Text(
                  veiculo.placa,
                  style: const TextStyle(
                    fontSize: 19,
                    fontWeight: FontWeight.w700,
                    color: Cores.conteudo,
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    veiculo.modelo,
                    style: const TextStyle(
                      fontSize: 15,
                      color: Cores.conteudoSuave,
                    ),
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            _Linha(
              icone: Icons.speed_outlined,
              rotulo: 'Quilometragem',
              valor: '${veiculo.quilometragemAtual} km',
            ),
            if (turno != null) ...[
              const SizedBox(height: 8),
              _Linha(
                icone: Icons.schedule_outlined,
                rotulo: 'Turno aberto desde',
                valor: _hora(turno!.inicioEm),
              ),
            ],
            if (aoEncerrarTurno != null) ...[
              const SizedBox(height: 16),
              OutlinedButton.icon(
                onPressed: aoEncerrarTurno,
                icon: const Icon(Icons.logout),
                label: const Text('Encerrar turno'),
              ),
            ],
          ],
        ),
      ),
    );
  }

  String _hora(DateTime d) {
    String doisDigitos(int n) => n.toString().padLeft(2, '0');
    return '${doisDigitos(d.day)}/${doisDigitos(d.month)} as '
        '${doisDigitos(d.hour)}:${doisDigitos(d.minute)}';
  }
}

/// Etiqueta colorida (prioridade, status).
class _Etiqueta extends StatelessWidget {
  final String texto;
  final Color cor;

  const _Etiqueta({required this.texto, required this.cor});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: cor.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(6),
        border: Border.all(color: cor.withValues(alpha: 0.4)),
      ),
      child: Text(
        texto,
        style: TextStyle(
          color: cor,
          fontSize: 12,
          fontWeight: FontWeight.w700,
          letterSpacing: 0.5,
        ),
      ),
    );
  }
}

/// Linha "icone + rotulo + valor" usada nos cartoes.
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

/// Faixa de situacao: conexao, fila pendente e rastreamento.
///
/// Fica no topo do painel porque responde, sem o motorista perguntar, as
/// duas duvidas que aparecem quando o sinal oscila: "estou conectado?" e
/// "o que eu registrei ja subiu?". Quando esta tudo em ordem e online,
/// nao aparece nada - informacao so quando ha o que dizer (RNF04).
class _BarraSituacao extends StatelessWidget {
  const _BarraSituacao();

  @override
  Widget build(BuildContext context) {
    final sinc = context.watch<Sincronizador>();
    final gps = context.watch<RastreamentoServico>();

    final semRede = !sinc.online;
    final temFila = sinc.temPendencias;
    final gpsComProblema = gps.situacao == SituacaoGps.semPermissao ||
        gps.situacao == SituacaoGps.servicoDesligado;

    if (!semRede && !temFila && !gpsComProblema) {
      return const SizedBox.shrink();
    }

    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (semRede)
            const Aviso(
              mensagem: 'Sem conexao. Voce pode continuar registrando: '
                  'tudo sera enviado quando a rede voltar.',
              icone: Icons.cloud_off,
              ehErro: false,
            ),
          if (semRede && (temFila || gpsComProblema))
            const SizedBox(height: 10),
          if (temFila)
            Aviso.info(
              mensagem: sinc.sincronizando
                  ? 'Enviando registros guardados...'
                  : '${sinc.pendentes} registro(s) aguardando envio.',
              icone: Icons.schedule,
            ),
          if (temFila && gpsComProblema) const SizedBox(height: 10),
          if (gpsComProblema)
            Aviso(mensagem: gps.erro ?? gps.resumo, icone: Icons.gps_off),
        ],
      ),
    );
  }
}

/// Icone da fila com o numero de pendencias.
class _BotaoFila extends StatelessWidget {
  final VoidCallback aoTocar;

  const _BotaoFila({required this.aoTocar});

  @override
  Widget build(BuildContext context) {
    final pendentes = context.watch<Sincronizador>().pendentes;

    return Stack(
      alignment: Alignment.center,
      children: [
        IconButton(
          icon: Icon(pendentes > 0 ? Icons.cloud_upload : Icons.cloud_done),
          tooltip: 'Registros aguardando envio',
          onPressed: aoTocar,
        ),
        if (pendentes > 0)
          Positioned(
            top: 6,
            right: 6,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
              decoration: BoxDecoration(
                color: Cores.prioridadeAlta,
                borderRadius: BorderRadius.circular(9),
              ),
              constraints: const BoxConstraints(minWidth: 18),
              child: Text(
                pendentes > 99 ? '99+' : '$pendentes',
                textAlign: TextAlign.center,
                style: const TextStyle(
                  color: Cores.marcaContraste,
                  fontSize: 11,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
          ),
      ],
    );
  }
}

/// Situacao do rastreamento durante o turno.
///
/// Existe por dois motivos. Para o motorista, responde "a central esta me
/// vendo?" - pergunta legitima de quem depende do sistema para ser
/// acionado. Para quem desenvolve e apresenta, torna visivel um requisito
/// que, sem isto, so se comprova olhando o banco de dados.
class _CartaoRastreamento extends StatelessWidget {
  const _CartaoRastreamento();

  @override
  Widget build(BuildContext context) {
    final gps = context.watch<RastreamentoServico>();
    final ativo = gps.situacao == SituacaoGps.ativo;
    final cor = ativo ? Cores.statusDisponivel : Cores.prioridadeAlta;

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(
                  ativo ? Icons.gps_fixed : Icons.gps_off,
                  size: 20,
                  color: cor,
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    gps.resumo,
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w600,
                      color: cor,
                    ),
                  ),
                ),
              ],
            ),
            if (ativo) ...[
              const SizedBox(height: 12),
              _Linha(
                icone: Icons.my_location,
                rotulo: 'Ultima leitura',
                valor: gps.ultima == null
                    ? 'aguardando o primeiro ponto'
                    : '${gps.ultima!.latitude.toStringAsFixed(5)}, '
                        '${gps.ultima!.longitude.toStringAsFixed(5)}',
              ),
              const SizedBox(height: 8),
              _Linha(
                icone: Icons.cloud_upload_outlined,
                rotulo: 'Enviadas neste turno',
                valor: '${gps.enviadasNaSessao}',
              ),
              if (gps.aguardandoEnvio > 0) ...[
                const SizedBox(height: 8),
                _Linha(
                  icone: Icons.hourglass_bottom,
                  rotulo: 'No proximo lote',
                  valor: '${gps.aguardandoEnvio}',
                ),
              ],
            ],
            if (gps.erro != null) ...[
              const SizedBox(height: 12),
              Text(
                gps.erro!,
                style: const TextStyle(
                  fontSize: 14,
                  color: Cores.prioridadeCritica,
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
