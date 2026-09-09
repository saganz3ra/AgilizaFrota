import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:uuid/uuid.dart';

import '../../core/api/api_excecao.dart';
import '../../core/auth/auth_servico.dart';
import '../../core/servicos/armazenamento.dart';
import '../../core/tema/cores.dart';
import '../../core/widgets/aviso.dart';
import '../../core/widgets/carregando.dart';
import '../painel/painel_modelo.dart';
import 'turno_servico.dart';

/// Abertura de turno com checklist obrigatorio (RF03 + RF04).
///
/// A ordem da tela reproduz o que o motorista faz de fato: escolhe o
/// veiculo, confere o hodometro, fotografa o painel e so entao percorre o
/// checklist. Tudo numa unica rolagem - navegar entre etapas seria mais
/// bonito e mais lento, e o motorista costuma estar com pressa (RNF04).
class IniciarTurnoPagina extends StatefulWidget {
  /// Itens vindos do painel, evitando uma segunda chamada a rede.
  final List<ItemChecklist> itensIniciais;

  const IniciarTurnoPagina({super.key, this.itensIniciais = const []});

  @override
  State<IniciarTurnoPagina> createState() => _IniciarTurnoPaginaState();
}

class _IniciarTurnoPaginaState extends State<IniciarTurnoPagina> {
  final _km = TextEditingController();
  final _rolagem = ScrollController();

  List<VeiculoOpcao> _veiculos = [];
  VeiculoOpcao? _veiculo;
  List<RespostaChecklist> _respostas = [];

  File? _foto;
  bool _carregando = true;
  bool _enviando = false;
  String? _erro;

  /// Gerado uma vez, no inicio: se o envio for repetido, o servidor
  /// reconhece o mesmo turno em vez de abrir outro (RNF03).
  final String _idLocal = const Uuid().v4();

  TurnoServico get _servico =>
      TurnoServico(context.read<AuthServico>().api);

  @override
  void initState() {
    super.initState();
    _respostas =
        widget.itensIniciais.map((i) => RespostaChecklist(i)).toList();
    _carregarDados();
  }

  @override
  void dispose() {
    _km.dispose();
    _rolagem.dispose();
    super.dispose();
  }

  Future<void> _carregarDados() async {
    setState(() {
      _carregando = true;
      _erro = null;
    });
    try {
      final veiculos = await _servico.veiculosDisponiveis();
      // Se o painel nao trouxe o catalogo, buscamos agora.
      final itens = _respostas.isNotEmpty
          ? _respostas.map((r) => r.item).toList()
          : await _servico.itensChecklist();

      if (!mounted) return;
      setState(() {
        _veiculos = veiculos;
        if (_respostas.isEmpty) {
          _respostas = itens.map((i) => RespostaChecklist(i)).toList();
        }
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

  void _selecionarVeiculo(VeiculoOpcao? v) {
    setState(() {
      _veiculo = v;
      // A quilometragem vem preenchida com o valor que o sistema conhece.
      // O motorista so corrige se o hodometro estiver diferente - menos
      // digitacao e menos erro (RNF11).
      if (v != null) _km.text = v.quilometragemAtual.toString();
    });
  }

  Armazenamento get _armazenamento =>
      Armazenamento(obterToken: context.read<AuthServico>().api.obterToken);

  Future<void> _obterFoto({required bool daGaleria}) async {
    try {
      final arquivo = daGaleria
          ? await _armazenamento.escolherDaGaleria()
          : await _armazenamento.fotografarPainel();
      if (arquivo != null && mounted) setState(() => _foto = arquivo);
    } catch (e) {
      if (mounted) {
        setState(() => _erro = 'Nao foi possivel obter a imagem: $e');
      }
    }
  }

  /// Valida o formulario e devolve a primeira pendencia, ou null.
  String? _pendencia() {
    if (_veiculo == null) return 'Selecione o veiculo do turno.';

    final km = int.tryParse(_km.text.trim());
    if (km == null) return 'Informe a quilometragem do hodometro.';
    if (km < _veiculo!.quilometragemAtual) {
      return 'A quilometragem nao pode ser menor que a ultima registrada '
          '(${_veiculo!.quilometragemAtual} km).';
    }
    if (_foto == null) return 'Fotografe o painel com o hodometro visivel.';

    final faltando = _respostas.where((r) => !r.respondido).length;
    if (faltando > 0) {
      return 'Responda todos os itens do checklist ($faltando restante(s)).';
    }
    return null;
  }

  Future<void> _abrirTurno() async {
    final pendencia = _pendencia();
    if (pendencia != null) {
      setState(() => _erro = pendencia);
      _rolagem.animateTo(0,
          duration: const Duration(milliseconds: 250), curve: Curves.easeOut);
      return;
    }

    // Item critico reprovado bloqueia o turno. Avisamos ANTES de enviar,
    // porque o backend ainda manda o veiculo para manutencao - uma acao
    // com consequencia para a frota inteira.
    final criticos = _respostas.where((r) => r.bloqueiaTurno).toList();
    if (criticos.isNotEmpty) {
      final seguir = await _confirmarItemCritico(criticos);
      if (seguir != true) return;
    }

    setState(() {
      _enviando = true;
      _erro = null;
    });

    // Capturados antes dos `await`, pelo mesmo motivo do encerramento.
    final armazenamento = _armazenamento;
    final servico = _servico;

    try {
      final url = await armazenamento.enviarFoto(_foto!);

      await servico.iniciar(
        idLocal: _idLocal,
        veiculoId: _veiculo!.id,
        kmInicial: int.parse(_km.text.trim()),
        fotoUrl: url,
        respostas: _respostas,
      );

      if (!mounted) return;
      Navigator.pop(context, true);
    } on ApiExcecao catch (e) {
      if (!mounted) return;
      setState(() {
        _enviando = false;
        _erro = e.mensagem;
      });
      _rolagem.animateTo(0,
          duration: const Duration(milliseconds: 250), curve: Curves.easeOut);
    }
  }

  Future<bool?> _confirmarItemCritico(List<RespostaChecklist> criticos) {
    final nomes = criticos.map((r) => '- ${r.item.descricao}').join('\n');
    return showDialog<bool>(
      context: context,
      builder: (d) => AlertDialog(
        title: const Text('Item critico reprovado'),
        content: Text(
          'Voce marcou como NAO CONFORME:\n\n$nomes\n\n'
          'O turno nao sera aberto e o veiculo ira para manutencao. '
          'A Central sera avisada. Confirma?',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(d, false),
            child: const Text('Revisar'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(d, true),
            child: const Text('Confirmar'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Iniciar turno')),
      body: _carregando
          ? const Carregando(rotulo: 'Carregando veiculos...')
          : _formulario(),
      bottomNavigationBar: _carregando ? null : _barraInferior(),
    );
  }

  Widget _formulario() {
    return ListView(
      controller: _rolagem,
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
      children: [
        if (_erro != null) ...[
          Aviso(mensagem: _erro!),
          const SizedBox(height: 16),
        ],

        // ---------- Veiculo ----------
        const _Secao(numero: 1, titulo: 'Veiculo'),
        const SizedBox(height: 10),
        if (_veiculos.isEmpty)
          const Aviso(
            mensagem: 'Nenhum veiculo disponivel no momento. '
                'Procure a Central.',
          )
        else
          DropdownButtonFormField<VeiculoOpcao>(
            initialValue: _veiculo,
            isExpanded: true,
            decoration: const InputDecoration(
              labelText: 'Selecione o veiculo',
              prefixIcon: Icon(Icons.directions_car_outlined),
            ),
            items: _veiculos
                .map((v) => DropdownMenuItem(value: v, child: Text(v.rotulo)))
                .toList(),
            onChanged: _enviando ? null : _selecionarVeiculo,
          ),
        const SizedBox(height: 24),

        // ---------- Quilometragem ----------
        const _Secao(numero: 2, titulo: 'Quilometragem'),
        const SizedBox(height: 10),
        TextField(
          controller: _km,
          enabled: !_enviando && _veiculo != null,
          keyboardType: TextInputType.number,
          inputFormatters: [FilteringTextInputFormatter.digitsOnly],
          style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w600),
          decoration: InputDecoration(
            labelText: 'Hodometro (km)',
            prefixIcon: const Icon(Icons.speed_outlined),
            helperText: _veiculo == null
                ? 'Selecione o veiculo primeiro'
                : 'Ultimo registro: ${_veiculo!.quilometragemAtual} km',
          ),
        ),
        const SizedBox(height: 24),

        // ---------- Foto ----------
        const _Secao(numero: 3, titulo: 'Foto do painel'),
        const SizedBox(height: 6),
        const Text(
          'Fotografe o painel com o hodometro legivel. '
          'A imagem comprova a quilometragem informada.',
          style: TextStyle(fontSize: 14, color: Cores.conteudoSuave),
        ),
        const SizedBox(height: 12),
        _AreaFoto(
          foto: _foto,
          aoFotografar: _enviando ? null : () => _obterFoto(daGaleria: false),
          aoEscolher: _enviando ? null : () => _obterFoto(daGaleria: true),
        ),
        const SizedBox(height: 24),

        // ---------- Checklist ----------
        _Secao(
          numero: 4,
          titulo: 'Checklist (${_respostas.where((r) => r.respondido).length}'
              '/${_respostas.length})',
        ),
        const SizedBox(height: 10),
        ..._respostas.map(
          (r) => _ItemChecklistCartao(
            resposta: r,
            habilitado: !_enviando,
            aoMudar: () => setState(() {}),
          ),
        ),
      ],
    );
  }

  Widget _barraInferior() {
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: ElevatedButton(
          onPressed: _enviando ? null : _abrirTurno,
          child: _enviando
              ? const SizedBox(
                  height: 22,
                  width: 22,
                  child: CircularProgressIndicator(
                    strokeWidth: 2.5,
                    color: Cores.marcaContraste,
                  ),
                )
              : const Text('Abrir turno'),
        ),
      ),
    );
  }
}

/// Cabecalho numerado de cada etapa do formulario.
class _Secao extends StatelessWidget {
  final int numero;
  final String titulo;

  const _Secao({required this.numero, required this.titulo});

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Container(
          height: 28,
          width: 28,
          alignment: Alignment.center,
          decoration: const BoxDecoration(
            color: Cores.marca,
            shape: BoxShape.circle,
          ),
          child: Text(
            '$numero',
            style: const TextStyle(
              color: Cores.marcaContraste,
              fontWeight: FontWeight.w700,
              fontSize: 15,
            ),
          ),
        ),
        const SizedBox(width: 10),
        Text(
          titulo,
          style: const TextStyle(
            fontSize: 18,
            fontWeight: FontWeight.w700,
            color: Cores.conteudo,
          ),
        ),
      ],
    );
  }
}

/// Area de captura/preview da foto.
class _AreaFoto extends StatelessWidget {
  final File? foto;
  final VoidCallback? aoFotografar;
  final VoidCallback? aoEscolher;

  const _AreaFoto({required this.foto, this.aoFotografar, this.aoEscolher});

  @override
  Widget build(BuildContext context) {
    if (foto == null) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          InkWell(
            onTap: aoFotografar,
            borderRadius: BorderRadius.circular(12),
            child: Container(
              height: 150,
              decoration: BoxDecoration(
                color: Cores.superficie,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: Cores.borda, width: 2),
              ),
              child: const Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.photo_camera_outlined,
                      size: 40, color: Cores.marca),
                  SizedBox(height: 10),
                  Text(
                    'Tocar para fotografar',
                    style: TextStyle(
                      fontSize: 16,
                      color: Cores.marca,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 8),
          // Saida para o emulador, onde nao ha camera de verdade.
          TextButton.icon(
            onPressed: aoEscolher,
            icon: const Icon(Icons.photo_library_outlined, size: 20),
            label: const Text('Escolher da galeria'),
          ),
        ],
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        ClipRRect(
          borderRadius: BorderRadius.circular(12),
          child: Image.file(foto!, height: 220, fit: BoxFit.cover),
        ),
        const SizedBox(height: 10),
        Row(
          children: [
            Expanded(
              child: OutlinedButton.icon(
                onPressed: aoFotografar,
                icon: const Icon(Icons.photo_camera_outlined),
                label: const Text('Refazer'),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: OutlinedButton.icon(
                onPressed: aoEscolher,
                icon: const Icon(Icons.photo_library_outlined),
                label: const Text('Galeria'),
              ),
            ),
          ],
        ),
      ],
    );
  }
}

/// Um item do checklist, com resposta Conforme / Nao conforme.
class _ItemChecklistCartao extends StatelessWidget {
  final RespostaChecklist resposta;
  final bool habilitado;
  final VoidCallback aoMudar;

  const _ItemChecklistCartao({
    required this.resposta,
    required this.habilitado,
    required this.aoMudar,
  });

  @override
  Widget build(BuildContext context) {
    final item = resposta.item;
    final reprovado = resposta.conforme == false;

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Cores.superficie,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: resposta.bloqueiaTurno ? Cores.prioridadeCritica : Cores.borda,
          width: resposta.bloqueiaTurno ? 2 : 1,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Text(
                  item.descricao,
                  style: const TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w500,
                    color: Cores.conteudo,
                  ),
                ),
              ),
              if (item.critico)
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: Cores.prioridadeCritica.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(5),
                  ),
                  child: const Text(
                    'CRITICO',
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                      color: Cores.prioridadeCritica,
                    ),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: _BotaoResposta(
                  rotulo: 'Conforme',
                  icone: Icons.check,
                  cor: Cores.statusDisponivel,
                  selecionado: resposta.conforme == true,
                  aoTocar: habilitado
                      ? () {
                          resposta.conforme = true;
                          aoMudar();
                        }
                      : null,
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _BotaoResposta(
                  rotulo: 'Nao conforme',
                  icone: Icons.close,
                  cor: Cores.prioridadeCritica,
                  selecionado: reprovado,
                  aoTocar: habilitado
                      ? () {
                          resposta.conforme = false;
                          aoMudar();
                        }
                      : null,
                ),
              ),
            ],
          ),
          // A observacao so aparece quando ha problema: campo vazio na tela
          // e ruido para quem esta com pressa.
          if (reprovado) ...[
            const SizedBox(height: 12),
            TextField(
              enabled: habilitado,
              maxLength: 300,
              minLines: 2,
              maxLines: 3,
              decoration: const InputDecoration(
                labelText: 'O que foi encontrado?',
                counterText: '',
              ),
              onChanged: (v) => resposta.observacao = v,
            ),
            if (resposta.bloqueiaTurno)
              const Text(
                'Item critico: o turno nao podera ser aberto e o veiculo '
                'ira para manutencao.',
                style: TextStyle(
                  fontSize: 13,
                  color: Cores.prioridadeCritica,
                  fontWeight: FontWeight.w500,
                ),
              ),
          ],
        ],
      ),
    );
  }
}

/// Botao grande de resposta (Conforme / Nao conforme).
class _BotaoResposta extends StatelessWidget {
  final String rotulo;
  final IconData icone;
  final Color cor;
  final bool selecionado;
  final VoidCallback? aoTocar;

  const _BotaoResposta({
    required this.rotulo,
    required this.icone,
    required this.cor,
    required this.selecionado,
    this.aoTocar,
  });

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: aoTocar,
      borderRadius: BorderRadius.circular(10),
      child: Container(
        height: 48,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: selecionado ? cor : Cores.superficie,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(
            color: selecionado ? cor : Cores.borda,
            width: selecionado ? 2 : 1,
          ),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              icone,
              size: 20,
              color: selecionado ? Cores.marcaContraste : cor,
            ),
            const SizedBox(width: 6),
            Flexible(
              child: Text(
                rotulo,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w600,
                  color: selecionado ? Cores.marcaContraste : Cores.conteudo,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
