// Registro de provedores de anúncio.
//
// Todo provedor exporta um objeto com:
//   request({ sessionId, stage, onReady(show), onGranted(), onClosed(), onUnavailable(reason), onError(err) })
//     - onReady(show): há um anúncio pronto; "show()" só é chamado quando o visitante clica em "Assistir anúncio".
//     - onGranted():   o PROVEDOR confirmou que o anúncio foi assistido até a recompensa.
//     - onClosed():    o visitante fechou o anúncio (antes ou depois da recompensa).
//     - onUnavailable / onError: sem anúncio ou falha -> o site libera o download direto.
//   destroy(): limpa o anúncio (chamado ao fechar a janela ou tentar de novo).
//
// "ads.verification" (vem do servidor) diz se a confirmação final é feita no navegador ("client")
// ou se o site deve esperar o callback do provedor no servidor ("server").

export async function createAdProvider(ads) {
  switch (ads.provider) {
    case 'test': {
      const { createTestProvider } = await import('./test-provider.js');
      return createTestProvider(ads);
    }
    case 'gpt': {
      const { createGptRewardedProvider } = await import('./gpt-rewarded.js');
      return createGptRewardedProvider(ads);
    }
    // >>> INTEGRAÇÃO REAL: para outro provedor, crie ./meu-provedor.js seguindo o contrato acima
    //     e adicione um "case" aqui (o nome precisa ser igual ao AD_PROVIDER do servidor).
    default:
      return null;
  }
}
