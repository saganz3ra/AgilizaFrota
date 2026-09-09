import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/offline/item_fila.dart';
import '../../core/offline/sincronizador.dart';
import '../../core/tema/cores.dart';
import '../../core/widgets/aviso.dart';
import '../../core/widgets/carregando.dart';

/// Registros aguardando envio (RNF03).
///
/// Existe para dar ao motorista a resposta de uma pergunta legitima:
/// "o que eu registrei realmente chegou na Central?". Sem essa tela, a
/// fila seria invisivel e ele nao teria como confiar no app quando o
/// sinal falha - e desconfianca faz voltar para o papel.
class FilaPagina extends StatefulWidget {
  const FilaPagina({super.key});

  @override
  State<FilaPagina> createState() => _FilaPaginaState();
}

class _FilaPaginaState extends State<FilaPagina> {
  List<ItemFila>? _itens;

  @override
  void initState() {
    super.initState();
    _carregar();
  }

  Future<void> _carregar() async {
    final itens = await context.read<Sincronizador>().listar();
    if (mounted) setState(() => _itens = itens);
  }

  Future<void> _sincronizar() async {
    await context.read<Sincronizador>().sincronizar();
    await _carregar();
  }

  Future<void> _descartar(ItemFila item) async {
    // Capturado antes do `await`: depois do dialogo o widget pode ja ter
    // saido da arvore, e usar o `context` ali e um erro em potencial.
    final sinc = context.read<Sincronizador>();

    final confirmou = await showDialog<bool>(
      context: context,
      builder: (d) => AlertDialog(
        title: const Text('Descartar registro?'),
        content: Text(
          'O registro "${item.descricao}" sera apagado do aparelho e '
          'NAO chegara a Central. Use apenas se ele estiver errado.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(d, false),
            child: const Text('Manter'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(d, true),
            style: TextButton.styleFrom(
              foregroundColor: Cores.prioridadeCritica,
            ),
            child: const Text('Descartar'),
          ),
        ],
      ),
    );
    if (confirmou == true && item.idLocal != null) {
      await sinc.descartar(item.idLocal!);
      if (mounted) await _carregar();
    }
  }

  @override
  Widget build(BuildContext context) {
    final sinc = context.watch<Sincronizador>();
    final itens = _itens;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Aguardando envio'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            tooltip: 'Atualizar',
            onPressed: _carregar,
          ),
        ],
      ),
      body: itens == null
          ? const Carregando()
          : itens.isEmpty
              ? _vazio()
              : ListView(
                  padding: const EdgeInsets.all(16),
                  children: [
                    if (sinc.ultimoResultado != null) ...[
                      Aviso.info(mensagem: sinc.ultimoResultado!),
                      const SizedBox(height: 16),
                    ],
                    Text(
                      '${itens.length} registro(s) guardado(s) no aparelho.',
                      style: const TextStyle(
                        fontSize: 15,
                        color: Cores.conteudoSuave,
                      ),
                    ),
                    const SizedBox(height: 12),
                    ...itens.map(
                      (i) => _CartaoItem(
                        item: i,
                        aoDescartar: () => _descartar(i),
                      ),
                    ),
                  ],
                ),
      bottomNavigationBar: itens == null || itens.isEmpty
          ? null
          : SafeArea(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: ElevatedButton.icon(
                  onPressed: sinc.sincronizando ? null : _sincronizar,
                  icon: sinc.sincronizando
                      ? const SizedBox(
                          height: 20,
                          width: 20,
                          child: CircularProgressIndicator(
                            strokeWidth: 2.5,
                            color: Cores.marcaContraste,
                          ),
                        )
                      : const Icon(Icons.cloud_upload_outlined),
                  label: Text(
                    sinc.sincronizando ? 'Enviando...' : 'Enviar agora',
                  ),
                ),
              ),
            ),
    );
  }

  Widget _vazio() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.cloud_done_outlined,
                size: 56, color: Cores.statusDisponivel),
            const SizedBox(height: 16),
            const Text(
              'Tudo enviado',
              style: TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.w700,
                color: Cores.conteudo,
              ),
            ),
            const SizedBox(height: 8),
            const Text(
              'Nenhum registro aguardando. Todos os seus lancamentos '
              'chegaram a Central.',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 15, color: Cores.conteudoSuave),
            ),
          ],
        ),
      ),
    );
  }
}

class _CartaoItem extends StatelessWidget {
  final ItemFila item;
  final VoidCallback aoDescartar;

  const _CartaoItem({required this.item, required this.aoDescartar});

  @override
  Widget build(BuildContext context) {
    final falhou = item.tentativas > 0;

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Cores.superficie,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: falhou ? Cores.prioridadeAlta : Cores.borda,
          width: falhou ? 2 : 1,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(
                falhou ? Icons.error_outline : Icons.schedule,
                size: 20,
                color: falhou ? Cores.prioridadeAlta : Cores.conteudoSuave,
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  item.descricao,
                  style: const TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w600,
                    color: Cores.conteudo,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            'Registrado em ${_momento(item.ocorridoEm)}',
            style: const TextStyle(fontSize: 14, color: Cores.conteudoSuave),
          ),
          if (falhou) ...[
            const SizedBox(height: 10),
            Text(
              'Recusado pela Central: ${item.ultimoErro ?? "motivo nao informado"}',
              style: const TextStyle(
                fontSize: 14,
                color: Cores.prioridadeAlta,
              ),
            ),
            const SizedBox(height: 6),
            Align(
              alignment: Alignment.centerRight,
              child: TextButton(
                onPressed: aoDescartar,
                style: TextButton.styleFrom(
                  foregroundColor: Cores.prioridadeCritica,
                ),
                child: const Text('Descartar'),
              ),
            ),
          ],
        ],
      ),
    );
  }

  String _momento(DateTime d) {
    final local = d.toLocal();
    String dd(int n) => n.toString().padLeft(2, '0');
    return '${dd(local.day)}/${dd(local.month)} as ${dd(local.hour)}:${dd(local.minute)}';
  }
}
