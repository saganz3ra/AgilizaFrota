// Testes de widget do Agiliza Frota.
//
// O que da para testar aqui sem rede nem Firebase: a decisao de tela feita
// pela raiz do app e os componentes puros de interface. O fluxo que depende
// de autenticacao e servidor e verificado por integracao (ver Sprint 12).

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:agilizafrota_mobile/core/tema/cores.dart';
import 'package:agilizafrota_mobile/core/widgets/aviso.dart';
import 'package:agilizafrota_mobile/main.dart';

void main() {
  group('Raiz do aplicativo', () {
    testWidgets(
      'sem configuracao do Firebase, explica o problema em vez de tela branca',
      (tester) async {
        await tester.pumpWidget(
          const AgilizaFrotaApp(falhaFirebase: 'FirebaseOptions ausente'),
        );
        await tester.pump();

        expect(find.text('Configuracao do Firebase ausente'), findsOneWidget);
        // A instrucao de correcao precisa aparecer para quem esta instalando.
        expect(find.textContaining('flutterfire configure'), findsOneWidget);
      },
    );
  });

  group('Aviso', () {
    testWidgets('erro usa a cor critica', (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(body: Aviso(mensagem: 'Falha ao enviar')),
        ),
      );

      expect(find.text('Falha ao enviar'), findsOneWidget);
      final icone = tester.widget<Icon>(find.byType(Icon));
      expect(icone.color, Cores.prioridadeCritica);
    });

    testWidgets('informativo usa a cor da marca', (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: Aviso.info(mensagem: '3 registros aguardando envio'),
          ),
        ),
      );

      expect(find.text('3 registros aguardando envio'), findsOneWidget);
      final icone = tester.widget<Icon>(find.byType(Icon));
      expect(icone.color, Cores.marca);
    });
  });

  group('Paleta', () {
    test('prioridades tem cores distintas e conhecidas', () {
      expect(Cores.daPrioridade('critica'), Cores.prioridadeCritica);
      expect(Cores.daPrioridade('alta'), Cores.prioridadeAlta);
      expect(Cores.daPrioridade('media'), Cores.prioridadeMedia);
      // Valor desconhecido nao pode quebrar a tela.
      expect(Cores.daPrioridade('inexistente'), Cores.prioridadeBaixa);
      expect(Cores.daPrioridade(null), Cores.prioridadeBaixa);
    });

    test('status de veiculo mapeia para as cores do painel web', () {
      expect(Cores.doStatusVeiculo('disponivel'), Cores.statusDisponivel);
      expect(Cores.doStatusVeiculo('em_uso'), Cores.statusEmUso);
      expect(Cores.doStatusVeiculo('manutencao'), Cores.statusManutencao);
      expect(Cores.doStatusVeiculo(null), Cores.conteudoSuave);
    });
  });
}
