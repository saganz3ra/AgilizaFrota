import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/auth/auth_servico.dart';
import '../../core/config/ambiente.dart';
import '../../core/tema/cores.dart';
import '../../core/widgets/aviso.dart';

/// Tela de login do motorista (RF01).
///
/// Deliberadamente minima: dois campos e um botao. O motorista entra uma
/// vez e a sessao permanece - o Firebase guarda a credencial no aparelho,
/// entao ele nao digita senha a cada turno (RNF11).
class LoginPagina extends StatefulWidget {
  const LoginPagina({super.key});

  @override
  State<LoginPagina> createState() => _LoginPaginaState();
}

class _LoginPaginaState extends State<LoginPagina> {
  final _formulario = GlobalKey<FormState>();
  final _email = TextEditingController();
  final _senha = TextEditingController();
  bool _enviando = false;
  bool _mostrarSenha = false;

  @override
  void dispose() {
    _email.dispose();
    _senha.dispose();
    super.dispose();
  }

  Future<void> _entrar() async {
    if (!_formulario.currentState!.validate()) return;
    FocusScope.of(context).unfocus();

    setState(() => _enviando = true);
    await context.read<AuthServico>().entrar(_email.text, _senha.text);
    if (mounted) setState(() => _enviando = false);
  }

  @override
  Widget build(BuildContext context) {
    final erro = context.watch<AuthServico>().erro;

    return Scaffold(
      backgroundColor: Cores.superficie,
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 32),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 420),
              child: Form(
                key: _formulario,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    const _Marca(),
                    const SizedBox(height: 40),

                    if (erro != null) ...[
                      Aviso(mensagem: erro),
                      const SizedBox(height: 20),
                    ],

                    TextFormField(
                      controller: _email,
                      decoration: const InputDecoration(
                        labelText: 'E-mail',
                        prefixIcon: Icon(Icons.mail_outline),
                      ),
                      keyboardType: TextInputType.emailAddress,
                      textInputAction: TextInputAction.next,
                      autocorrect: false,
                      enabled: !_enviando,
                      validator: (v) {
                        if (v == null || v.trim().isEmpty) {
                          return 'Informe seu e-mail.';
                        }
                        if (!v.contains('@')) return 'E-mail invalido.';
                        return null;
                      },
                    ),
                    const SizedBox(height: 16),

                    TextFormField(
                      controller: _senha,
                      decoration: InputDecoration(
                        labelText: 'Senha',
                        prefixIcon: const Icon(Icons.lock_outline),
                        suffixIcon: IconButton(
                          icon: Icon(_mostrarSenha
                              ? Icons.visibility_off_outlined
                              : Icons.visibility_outlined),
                          onPressed: () =>
                              setState(() => _mostrarSenha = !_mostrarSenha),
                          tooltip: _mostrarSenha ? 'Ocultar senha' : 'Mostrar senha',
                        ),
                      ),
                      obscureText: !_mostrarSenha,
                      enabled: !_enviando,
                      textInputAction: TextInputAction.done,
                      onFieldSubmitted: (_) => _entrar(),
                      validator: (v) => (v == null || v.isEmpty)
                          ? 'Informe sua senha.'
                          : null,
                    ),
                    const SizedBox(height: 28),

                    ElevatedButton(
                      onPressed: _enviando ? null : _entrar,
                      child: _enviando
                          ? const SizedBox(
                              height: 22,
                              width: 22,
                              child: CircularProgressIndicator(
                                strokeWidth: 2.5,
                                color: Cores.marcaContraste,
                              ),
                            )
                          : const Text('Entrar'),
                    ),
                    const SizedBox(height: 24),

                    const Text(
                      'Esqueceu a senha? Procure a Central para redefinir.',
                      textAlign: TextAlign.center,
                      style: TextStyle(color: Cores.conteudoSuave, fontSize: 14),
                    ),

                    // Em desenvolvimento, mostrar o servidor ajuda a
                    // diagnosticar "nao conecta" sem abrir o codigo.
                    if (Ambiente.ehDesenvolvimento) ...[
                      const SizedBox(height: 20),
                      Text(
                        'Servidor: ${Ambiente.apiUrl}',
                        textAlign: TextAlign.center,
                        style: const TextStyle(
                          color: Cores.conteudoSuave,
                          fontSize: 12,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// Marca do sistema no topo da tela de login.
class _Marca extends StatelessWidget {
  const _Marca();

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Container(
          height: 84,
          width: 84,
          decoration: BoxDecoration(
            color: Cores.marca,
            borderRadius: BorderRadius.circular(20),
          ),
          child: const Icon(
            Icons.local_hospital_outlined,
            color: Cores.marcaContraste,
            size: 46,
          ),
        ),
        const SizedBox(height: 20),
        const Text(
          'Agiliza Frota',
          style: TextStyle(
            fontSize: 28,
            fontWeight: FontWeight.w700,
            color: Cores.conteudo,
          ),
        ),
        const SizedBox(height: 6),
        const Text(
          'Aplicativo do motorista',
          style: TextStyle(fontSize: 16, color: Cores.conteudoSuave),
        ),
      ],
    );
  }
}
