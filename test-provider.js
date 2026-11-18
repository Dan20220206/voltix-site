// MODO DE TESTE — não exibe anúncio real e não precisa de conta de anúncios.
//
// Simula um provedor com verificação no servidor: ao clicar em "Concluir anúncio de teste",
// este script faz o papel do servidor do provedor e chama /api/reward/callback/test.
// O site só libera o download depois que o servidor confirma (mesmo caminho de um provedor real).
//
// Cenários pela URL (para testar as mensagens de erro):
//   ?ad=empty  -> nenhum anúncio disponível
//   ?ad=error  -> falha ao carregar
//   ?ad=slow   -> nunca fica pronto (testa o limite de AD_LOAD_TIMEOUT_MS)
//   ?ad=nossv  -> o anúncio termina, mas o servidor não recebe o callback (testa a falha de verificação)

export function createTestProvider() {
  let stage = null;
  let timer = null;
  const scenario = new URLSearchParams(location.search).get('ad') || '';

  function clearStage() {
    if (!stage) return;
    stage.hidden = true;
    stage.replaceChildren();
  }

  function button(label, cls, onClick) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `btn ${cls}`;
    b.textContent = label;
    b.addEventListener('click', onClick);
    return b;
  }

  return {
    name: 'test',

    request({ sessionId, stage: stageEl, onReady, onGranted, onClosed, onUnavailable, onError }) {
      stage = stageEl;
      // Atraso de "rede" para carregar o anúncio falso (não tem relação com a liberação do download).
      timer = setTimeout(() => {
        if (scenario === 'empty') return onUnavailable('Nenhum anúncio disponível agora (simulado).');
        if (scenario === 'error') return onError(new Error('Falha ao carregar o anúncio (simulado).'));
        if (scenario === 'slow') return;
        onReady(show);
      }, 500);

      function show() {
        stage.hidden = false;
        const h = document.createElement('h3');
        h.textContent = 'ANÚNCIO DE TESTE';
        const p = document.createElement('p');
        p.textContent = 'Nenhum anúncio real é exibido no modo de teste. Escolha o que o "provedor" deve informar:';
        const row = document.createElement('div');
        row.className = 'row';

        row.append(
          button('Concluir anúncio de teste', 'btn--primary', async (e) => {
            e.currentTarget.disabled = true;
            if (scenario !== 'nossv') {
              // Papel do servidor do provedor: avisa o seu servidor que a recompensa foi ganha.
              try {
                await fetch('/api/reward/callback/test', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ sessionId }),
                });
              } catch { /* o site vai detectar a falha na verificação */ }
            }
            clearStage();
            onGranted();
            onClosed();
          }),
          button('Fechar antes do fim', 'btn--ghost', () => { clearStage(); onClosed(); }),
          button('Simular erro na reprodução', 'btn--ghost', () => { clearStage(); onError(new Error('O anúncio falhou durante a reprodução (simulado).')); }),
        );
        stage.replaceChildren(h, p, row);
      }
    },

    destroy() {
      clearTimeout(timer);
      clearStage();
    },
  };
}
