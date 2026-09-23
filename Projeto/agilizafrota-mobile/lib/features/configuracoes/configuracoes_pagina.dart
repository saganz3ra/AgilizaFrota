import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/auth/auth_servico.dart';
import '../../core/notificacoes/notificacao_push_servico.dart';
import '../../core/tema/cores.dart';
import '../../core/tema/tema_controller.dart';

/// Configurações do motorista: preferências de interface deste aparelho
/// (tema e tamanho da fonte) e troca de senha. Nada de negócio aqui — só
/// conforto de uso (RNF04) e segurança da conta (RNF01).
class ConfiguracoesPagina extends StatelessWidget {
  const ConfiguracoesPagina({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Configurações')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: const [
          _SecaoAparencia(),
          SizedBox(height: 16),
          _SecaoNotificacoes(),
          SizedBox(height: 16),
          _SecaoSeguranca(),
        ],
      ),
    );
  }
}

/// Valores de escala de fonte oferecidos (multiplicador do tamanho do texto).
const _opcoesFonte = <double>[0.9, 1.0, 1.2];

/// Encaixa a escala salva na opção mais próxima, para o SegmentedButton ter
/// sempre um valor válido selecionado.
double _fonteMaisProxima(double atual) {
  var melhor = _opcoesFonte.first;
  for (final v in _opcoesFonte) {
    if ((v - atual).abs() < (melhor - atual).abs()) melhor = v;
  }
  return melhor;
}

class _SecaoAparencia extends StatelessWidget {
  const _SecaoAparencia();

  @override
  Widget build(BuildContext context) {
    final tema = context.watch<TemaController>();

    return _Cartao(
      titulo: 'Aparência',
      filhos: [
        const _Rotulo('Tema'),
        SizedBox(
          width: double.infinity,
          child: SegmentedButton<ThemeMode>(
            showSelectedIcon: false,
            segments: const [
              ButtonSegment(
                value: ThemeMode.system,
                label: Text('Sistema'),
                icon: Icon(Icons.brightness_auto),
              ),
              ButtonSegment(
                value: ThemeMode.light,
                label: Text('Claro'),
                icon: Icon(Icons.light_mode),
              ),
              ButtonSegment(
                value: ThemeMode.dark,
                label: Text('Escuro'),
                icon: Icon(Icons.dark_mode),
              ),
            ],
            selected: {tema.modo},
            onSelectionChanged: (s) =>
                context.read<TemaController>().definirModo(s.first),
          ),
        ),
        const SizedBox(height: 20),
        const _Rotulo('Tamanho da fonte'),
        SizedBox(
          width: double.infinity,
          child: SegmentedButton<double>(
            showSelectedIcon: false,
            segments: const [
              ButtonSegment(value: 0.9, label: Text('Pequeno')),
              ButtonSegment(value: 1.0, label: Text('Padrão')),
              ButtonSegment(value: 1.2, label: Text('Grande')),
            ],
            selected: {_fonteMaisProxima(tema.escalaFonte)},
            onSelectionChanged: (s) =>
                context.read<TemaController>().definirEscalaFonte(s.first),
          ),
        ),
      ],
    );
  }
}

class _SecaoNotificacoes extends StatefulWidget {
  const _SecaoNotificacoes();

  @override
  State<_SecaoNotificacoes> createState() => _SecaoNotificacoesState();
}

class _SecaoNotificacoesState extends State<_SecaoNotificacoes> {
  bool? _ativo; // null enquanto carrega
  bool _ocupado = false;

  @override
  void initState() {
    super.initState();
    _carregar();
  }

  Future<void> _carregar() async {
    final v = await context.read<NotificacaoPushServico>().ativo();
    if (mounted) setState(() => _ativo = v);
  }

  Future<void> _alternar(bool valor) async {
    setState(() => _ocupado = true);
    final efetivo =
        await context.read<NotificacaoPushServico>().definirAtivo(valor);
    if (!mounted) return;
    setState(() {
      _ativo = efetivo;
      _ocupado = false;
    });
    // Pediu para ligar mas não conseguiu (permissão negada no aparelho).
    if (valor && !efetivo) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
            'Permissão de notificação negada. Libere nas configurações do sistema.',
          ),
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return _Cartao(
      titulo: 'Notificações',
      filhos: [
        SwitchListTile(
          contentPadding: EdgeInsets.zero,
          title: const Text('Alertas de acionamento'),
          subtitle: const Text(
            'Avisar quando você for acionado para um chamado, mesmo com o app fechado.',
          ),
          value: _ativo ?? true,
          onChanged: (_ativo == null || _ocupado) ? null : _alternar,
        ),
      ],
    );
  }
}

class _SecaoSeguranca extends StatefulWidget {
  const _SecaoSeguranca();

  @override
  State<_SecaoSeguranca> createState() => _SecaoSegurancaState();
}

class _SecaoSegurancaState extends State<_SecaoSeguranca> {
  final _atual = TextEditingController();
  final _nova = TextEditingController();
  final _confirma = TextEditingController();
  bool _enviando = false;
  String? _erro;
  String? _ok;

  @override
  void dispose() {
    _atual.dispose();
    _nova.dispose();
    _confirma.dispose();
    super.dispose();
  }

  Future<void> _submeter() async {
    setState(() {
      _erro = null;
      _ok = null;
    });

    if (_nova.text.length < 6) {
      setState(() => _erro = 'A nova senha deve ter ao menos 6 caracteres.');
      return;
    }
    if (_nova.text != _confirma.text) {
      setState(() => _erro = 'A confirmação não confere com a nova senha.');
      return;
    }

    setState(() => _enviando = true);
    try {
      await context
          .read<AuthServico>()
          .trocarSenha(atual: _atual.text, nova: _nova.text);
      if (!mounted) return;
      setState(() {
        _ok = 'Senha alterada com sucesso.';
      });
      _atual.clear();
      _nova.clear();
      _confirma.clear();
    } catch (e) {
      if (!mounted) return;
      // `trocarSenha` lança uma mensagem pronta (String).
      setState(() => _erro = e.toString());
    } finally {
      if (mounted) setState(() => _enviando = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return _Cartao(
      titulo: 'Segurança',
      filhos: [
        TextField(
          controller: _atual,
          obscureText: true,
          decoration: const InputDecoration(labelText: 'Senha atual'),
        ),
        const SizedBox(height: 12),
        TextField(
          controller: _nova,
          obscureText: true,
          decoration: const InputDecoration(
            labelText: 'Nova senha',
            helperText: 'Ao menos 6 caracteres',
          ),
        ),
        const SizedBox(height: 12),
        TextField(
          controller: _confirma,
          obscureText: true,
          decoration: const InputDecoration(labelText: 'Confirmar nova senha'),
        ),
        if (_erro != null) ...[
          const SizedBox(height: 12),
          _Mensagem(texto: _erro!, cor: Cores.prioridadeCritica),
        ],
        if (_ok != null) ...[
          const SizedBox(height: 12),
          _Mensagem(texto: _ok!, cor: Cores.statusDisponivel),
        ],
        const SizedBox(height: 16),
        ElevatedButton(
          onPressed: _enviando ? null : _submeter,
          child: _enviando
              ? const SizedBox(
                  height: 22,
                  width: 22,
                  child: CircularProgressIndicator(strokeWidth: 2),
                )
              : const Text('Alterar senha'),
        ),
      ],
    );
  }
}

/// Cartão com título e uma coluna de conteúdo. Usa o CardTheme do app.
class _Cartao extends StatelessWidget {
  final String titulo;
  final List<Widget> filhos;

  const _Cartao({required this.titulo, required this.filhos});

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              titulo,
              style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700),
            ),
            const SizedBox(height: 16),
            ...filhos,
          ],
        ),
      ),
    );
  }
}

class _Rotulo extends StatelessWidget {
  final String texto;
  const _Rotulo(this.texto);

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Text(
        texto,
        style: TextStyle(
          fontSize: 14,
          fontWeight: FontWeight.w600,
          color: Theme.of(context).colorScheme.onSurfaceVariant,
        ),
      ),
    );
  }
}

class _Mensagem extends StatelessWidget {
  final String texto;
  final Color cor;
  const _Mensagem({required this.texto, required this.cor});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: cor.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Text(texto, style: TextStyle(color: cor, fontSize: 14)),
    );
  }
}
