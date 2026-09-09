import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';

import '../../core/api/api_excecao.dart';
import '../../core/auth/auth_servico.dart';
import '../../core/servicos/armazenamento.dart';
import '../../core/tema/cores.dart';
import '../../core/widgets/aviso.dart';
import '../painel/painel_modelo.dart';
import 'turno_servico.dart';

/// Encerramento de turno (RF03).
///
/// Bem mais curto que a abertura: dois campos. O checklist e obrigatorio
/// so na entrada, quando ainda da tempo de trocar de veiculo; ao final o
/// que importa e fechar a quilometragem com a mesma evidencia fotografica.
class EncerrarTurnoPagina extends StatefulWidget {
  final TurnoResumo turno;
  final VeiculoResumo veiculo;

  const EncerrarTurnoPagina({
    super.key,
    required this.turno,
    required this.veiculo,
  });

  @override
  State<EncerrarTurnoPagina> createState() => _EncerrarTurnoPaginaState();
}

class _EncerrarTurnoPaginaState extends State<EncerrarTurnoPagina> {
  final _km = TextEditingController();
  File? _foto;
  bool _enviando = false;
  String? _erro;

  @override
  void initState() {
    super.initState();
    // Sugere a quilometragem que o sistema conhece; o motorista ajusta
    // para o que o hodometro mostra agora.
    _km.text = widget.veiculo.quilometragemAtual.toString();
  }

  @override
  void dispose() {
    _km.dispose();
    super.dispose();
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
      if (mounted) setState(() => _erro = 'Nao foi possivel obter a imagem: $e');
    }
  }

  String? _pendencia() {
    final km = int.tryParse(_km.text.trim());
    if (km == null) return 'Informe a quilometragem final.';
    // O backend tambem barra isso (CHECK no banco), mas avisar aqui evita
    // uma ida a rede e uma mensagem tecnica.
    if (km < widget.turno.kmInicial) {
      return 'A quilometragem final nao pode ser menor que a inicial '
          '(${widget.turno.kmInicial} km).';
    }
    if (_foto == null) return 'Fotografe o painel com o hodometro visivel.';
    return null;
  }

  Future<void> _encerrar() async {
    final pendencia = _pendencia();
    if (pendencia != null) {
      setState(() => _erro = pendencia);
      return;
    }

    setState(() {
      _enviando = true;
      _erro = null;
    });

    // Capturados antes dos `await`: o envio da foto demora, e depois dele
    // o `context` pode nao ser mais valido.
    final armazenamento = _armazenamento;
    final servico = TurnoServico(context.read<AuthServico>().api);

    try {
      final url = await armazenamento.enviarFoto(_foto!);

      await servico.encerrar(
        turnoId: widget.turno.id,
        kmFinal: int.parse(_km.text.trim()),
        fotoUrl: url,
      );

      if (!mounted) return;
      Navigator.pop(context, true);
    } on ApiExcecao catch (e) {
      if (!mounted) return;
      setState(() {
        _enviando = false;
        _erro = e.mensagem;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final rodados = (int.tryParse(_km.text.trim()) ?? widget.turno.kmInicial) -
        widget.turno.kmInicial;

    return Scaffold(
      appBar: AppBar(title: const Text('Encerrar turno')),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
        children: [
          if (_erro != null) ...[
            Aviso(mensagem: _erro!),
            const SizedBox(height: 16),
          ],

          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    '${widget.veiculo.placa} - ${widget.veiculo.modelo}',
                    style: const TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w700,
                      color: Cores.conteudo,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'Turno aberto com ${widget.turno.kmInicial} km',
                    style: const TextStyle(
                      fontSize: 15,
                      color: Cores.conteudoSuave,
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 24),

          TextField(
            controller: _km,
            enabled: !_enviando,
            keyboardType: TextInputType.number,
            inputFormatters: [FilteringTextInputFormatter.digitsOnly],
            style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w600),
            decoration: InputDecoration(
              labelText: 'Hodometro agora (km)',
              prefixIcon: const Icon(Icons.speed_outlined),
              helperText: rodados > 0
                  ? '$rodados km rodados neste turno'
                  : 'Informe a quilometragem atual do painel',
            ),
            // Recalcula o "rodados" enquanto ele digita.
            onChanged: (_) => setState(() {}),
          ),
          const SizedBox(height: 24),

          const Text(
            'Foto do painel',
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.w700,
              color: Cores.conteudo,
            ),
          ),
          const SizedBox(height: 12),

          if (_foto == null) ...[
            InkWell(
              onTap: _enviando ? null : () => _obterFoto(daGaleria: false),
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
              onPressed: _enviando ? null : () => _obterFoto(daGaleria: true),
              icon: const Icon(Icons.photo_library_outlined, size: 20),
              label: const Text('Escolher da galeria'),
            ),
          ] else ...[
            ClipRRect(
              borderRadius: BorderRadius.circular(12),
              child: Image.file(_foto!, height: 220, fit: BoxFit.cover),
            ),
            const SizedBox(height: 10),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed:
                        _enviando ? null : () => _obterFoto(daGaleria: false),
                    icon: const Icon(Icons.photo_camera_outlined),
                    label: const Text('Refazer'),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed:
                        _enviando ? null : () => _obterFoto(daGaleria: true),
                    icon: const Icon(Icons.photo_library_outlined),
                    label: const Text('Galeria'),
                  ),
                ),
              ],
            ),
          ],
        ],
      ),
      bottomNavigationBar: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: ElevatedButton(
            onPressed: _enviando ? null : _encerrar,
            child: _enviando
                ? const SizedBox(
                    height: 22,
                    width: 22,
                    child: CircularProgressIndicator(
                      strokeWidth: 2.5,
                      color: Cores.marcaContraste,
                    ),
                  )
                : const Text('Encerrar turno'),
          ),
        ),
      ),
    );
  }
}
