import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';

import 'core/auth/auth_servico.dart';
import 'core/offline/sincronizador.dart';
import 'core/tema/cores.dart';
import 'core/tema/tema.dart';
import 'core/widgets/aviso.dart';
import 'core/widgets/carregando.dart';
import 'features/login/login_pagina.dart';
import 'features/painel/painel_pagina.dart';
import 'features/rastreamento/rastreamento_servico.dart';
import 'firebase_options.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // O app do motorista e usado dentro do veiculo, apoiado no suporte:
  // travar em retrato evita a tela girar sozinha em curva ou freada.
  await SystemChrome.setPreferredOrientations([
    DeviceOrientation.portraitUp,
    DeviceOrientation.portraitDown,
  ]);

  // As credenciais do projeto ficam em `firebase_options.dart`, gerado
  // pelo comando `flutterfire configure`. Esse arquivo NAO contem segredo:
  // as chaves de cliente do Firebase sao publicas por natureza, e quem
  // protege os dados sao as regras de acesso e o nosso backend.
  String? falhaFirebase;
  try {
    await Firebase.initializeApp(
      options: DefaultFirebaseOptions.currentPlatform,
    );
  } catch (e) {
    falhaFirebase = e.toString();
  }

  runApp(AgilizaFrotaApp(falhaFirebase: falhaFirebase));
}

/// Raiz do aplicativo.
class AgilizaFrotaApp extends StatelessWidget {
  /// Preenchido quando o Firebase nao inicializa - quase sempre por falta
  /// do arquivo de configuracao. Mostramos a causa em vez de uma tela
  /// branca, que nao ajuda ninguem a resolver.
  final String? falhaFirebase;

  const AgilizaFrotaApp({super.key, this.falhaFirebase});

  @override
  Widget build(BuildContext context) {
    if (falhaFirebase != null) {
      return MaterialApp(
        title: 'Agiliza Frota',
        theme: TemaApp.claro,
        debugShowCheckedModeBanner: false,
        home: _TelaFalhaConfiguracao(detalhe: falhaFirebase!),
      );
    }

    // Tres servicos com ciclo de vida do app inteiro. A ordem importa:
    // o sincronizador precisa do cliente HTTP criado pela autenticacao, e
    // o rastreamento precisa do sincronizador para enfileirar posicoes
    // quando faltar rede.
    return MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => AuthServico()),
        ChangeNotifierProvider(
          create: (ctx) => Sincronizador(api: ctx.read<AuthServico>().api),
        ),
        ChangeNotifierProvider(
          create: (ctx) => RastreamentoServico(
            api: ctx.read<AuthServico>().api,
            sincronizador: ctx.read<Sincronizador>(),
          ),
        ),
      ],
      child: MaterialApp(
        title: 'Agiliza Frota',
        theme: TemaApp.claro,
        debugShowCheckedModeBanner: false,
        home: const _Raiz(),
      ),
    );
  }
}

/// Decide a tela a partir da situacao da sessao.
class _Raiz extends StatelessWidget {
  const _Raiz();

  @override
  Widget build(BuildContext context) {
    final situacao = context.watch<AuthServico>().situacao;

    switch (situacao) {
      case SituacaoAuth.verificando:
        return const Scaffold(
          backgroundColor: Cores.superficie,
          body: Carregando(rotulo: 'Agiliza Frota'),
        );
      case SituacaoAuth.deslogado:
        return const LoginPagina();
      case SituacaoAuth.autenticado:
        return const PainelPagina();
    }
  }
}

/// Tela exibida quando falta a configuracao do Firebase.
class _TelaFalhaConfiguracao extends StatelessWidget {
  final String detalhe;

  const _TelaFalhaConfiguracao({required this.detalhe});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Icon(Icons.settings_outlined,
                  size: 56, color: Cores.conteudoSuave),
              const SizedBox(height: 20),
              const Text(
                'Configuracao do Firebase ausente',
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 22,
                  fontWeight: FontWeight.w700,
                  color: Cores.conteudo,
                ),
              ),
              const SizedBox(height: 16),
              const Aviso(
                mensagem:
                    'Rode "flutterfire configure" na pasta do projeto para '
                    'gerar as credenciais e abra o app novamente.',
              ),
              const SizedBox(height: 16),
              Text(
                detalhe,
                style: const TextStyle(
                  fontSize: 12,
                  color: Cores.conteudoSuave,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
