import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/api/api_excecao.dart';
import '../../core/auth/auth_servico.dart';
import '../../core/tema/cores.dart';
import '../../core/tema/tema.dart';
import '../../core/widgets/aviso.dart';
import '../../core/widgets/carregando.dart';
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
      setState(() {
        _painel =
            PainelMotorista.doJson((resposta as Map).cast<String, dynamic>());
        _carregando = false;
      });
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
            _CartaoAtendimento(atendimento: painel.atendimento!),
            const SizedBox(height: 16),
          ] else if (painel.atribuicao != null) ...[
            _CartaoChamado(chamado: painel.atribuicao!),
            const SizedBox(height: 16),
          ],

          if (painel.veiculo != null) ...[
            _CartaoVeiculo(veiculo: painel.veiculo!, turno: painel.turno),
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

  /// Por enquanto apenas sinaliza; as telas de turno e atendimento entram
  /// nas proximas etapas e serao ligadas aqui.
  void _executarAcao(ProximaAcao acao) {
    if (acao.ehEspera) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('Em breve: ${acao.rotulo}')),
    );
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

  const _CartaoVeiculo({required this.veiculo, this.turno});

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
