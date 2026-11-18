// Fluxo do botão "Baixar Voltix":
//   oferta de anúncio (identificada) -> visitante aceita -> anúncio -> confirmação oficial
//   do provedor (no navegador ou no servidor) -> botão "Baixar arquivo" liberado.
// Se o anúncio estiver indisponível ou falhar, o download direto é liberado com uma mensagem clara.
// Nada aqui libera o download por tempo: só os eventos do provedor (ou do servidor) liberam.

import { createAdProvider } from './ads/index.js';
import { fileName } from './common.js';

const $ = (id) => document.getElementById(id);

export function initDownloadFlow({ ads, version, openButton }) {
  const modal = $('download-modal');
  const panel = modal.querySelector('.modal__panel');
  const adLabel = modal.querySelector('.ad-label');
  const intro = $('dl-intro');
  const stage = $('ad-stage');
  const status = $('dl-status');
  const watchBtn = $('dl-watch');
  const retryBtn = $('dl-retry');
  const fileLink = $('dl-file');
  const skipBtn = $('dl-skip');
  const cancelBtn = $('dl-cancel');
  const fileInfo = $('dl-file-info');
  const lockerLink = $('dl-locker');

  let provider = null;
  let showAd = null;
  let state = 'idle'; // idle | loading | ready | playing | granted | verifying | closed | failed | unlocked
  let run = 0;        // muda a cada tentativa; eventos de tentativas antigas são ignorados
  let loadTimer = null;
  let pollTimer = null;
  let lastFocus = null;

  const name = fileName(version.url);
  fileLink.href = version.url;
  fileLink.setAttribute('download', name);
  fileInfo.textContent = [name, version.size].filter(Boolean).join(' · ');

  /* ---------------- abrir / fechar ---------------- */

  openButton.addEventListener('click', open);
  modal.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) close(); });
  document.addEventListener('keydown', (e) => {
    if (modal.hidden) return;
    if (e.key === 'Escape' && state !== 'playing') { e.preventDefault(); close(); }
    if (e.key === 'Tab') trapFocus(e);
  });
  watchBtn.addEventListener('click', watch);
  retryBtn.addEventListener('click', startOffer);
  skipBtn.addEventListener('click', () => unlock('skip'));
  fileLink.addEventListener('click', () => {
    setStatus('ok', 'Download iniciado. Veja abaixo como instalar.');
  });

  function open() {
    lastFocus = document.activeElement;
    modal.hidden = false;
    document.body.style.overflow = 'hidden';
    panel.focus();
    lockerLink.hidden = true;
    if (!ads || !ads.provider || ads.provider === 'none') {
      adLabel.hidden = true;
      intro.hidden = true;
      unlock('disabled');
    } else if (ads.provider === 'lootlabs') {
      openLootLabs();
    } else {
      adLabel.hidden = false;
      startOffer();
    }
  }

  function close() {
    teardown();
    state = 'idle';
    modal.hidden = true;
    document.body.style.overflow = '';
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  function teardown() {
    run++;
    clearTimeout(loadTimer);
    clearTimeout(pollTimer);
    showAd = null;
    if (provider && provider.destroy) { try { provider.destroy(); } catch { /* ignora */ } }
    provider = null;
  }

  /* ---------------- interface ---------------- */

  function setStatus(tone, message) {
    status.dataset.tone = tone || '';
    status.textContent = message || '';
  }

  function view({ tone = '', message = '', watch = false, watchEnabled = false, retry = false, file = false, skip = false, cancel = 'Agora não' }) {
    setStatus(tone, message);
    watchBtn.hidden = !watch;
    watchBtn.disabled = !watchEnabled;
    retryBtn.hidden = !retry;
    fileLink.hidden = !file;
    fileInfo.hidden = !file;
    skipBtn.hidden = !(skip && ads && ads.allowSkip);
    cancelBtn.textContent = cancel;
  }

  function trapFocus(e) {
    const items = [...panel.querySelectorAll('button, a[href], [tabindex]:not([tabindex="-1"])')]
      .filter((n) => !n.hidden && !n.disabled && n.offsetParent !== null);
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  /* ---------------- LootLabs (link locker) ---------------- */
  // O site não recebe confirmação do LootLabs: quem leva o visitante ao arquivo no fim das
  // tarefas é o próprio LootLabs. Aqui só mostramos um aviso honesto e o link, que abre em
  // nova aba somente quando o visitante clica.

  lockerLink.addEventListener('click', () => {
    setStatus('ok', 'O LootLabs abriu em outra aba. Ao terminar as etapas de lá, você volta para a página de download do Voltix.');
    cancelBtn.textContent = 'Fechar';
  });

  function openLootLabs() {
    state = 'locker';
    adLabel.hidden = false;
    adLabel.textContent = 'Link com anúncios (LootLabs)';
    const url = String(version.lootlabsUrl || '');
    if (!/^https:\/\//i.test(url)) {
      // Link não configurado: não trava o visitante.
      adLabel.hidden = true;
      intro.hidden = true;
      fail('O link do LootLabs desta versão ainda não foi configurado.');
      return;
    }
    intro.hidden = false;
    intro.textContent = 'O download passa pelo LootLabs, um site parceiro que ajuda a manter o Voltix. ' +
      'Lá podem aparecer tarefas de anunciantes. No fim, você volta para cá e clica em Baixar Voltix. ' +
      'Não instale programas nem ative notificações que você não reconheça.';
    lockerLink.href = url;
    view({ message: 'O link abre em uma nova aba.' });
    lockerLink.hidden = false;
    lockerLink.focus();
  }

  /* ---------------- fluxo do anúncio ---------------- */

  async function createSession() {
    const res = await fetch('/api/reward/session', { method: 'POST' });
    if (!res.ok) throw new Error('sessão');
    return (await res.json()).sessionId;
  }

  async function startOffer() {
    teardown();
    const my = run;
    const alive = () => my === run;
    state = 'loading';
    intro.hidden = false;
    view({ tone: 'busy', message: 'Carregando anúncio…', watch: true, skip: true });

    let sessionId = null;
    try {
      sessionId = await createSession();
    } catch {
      if (ads.verification === 'server') { if (alive()) fail('Não foi possível iniciar a verificação do anúncio.'); return; }
    }
    if (!alive()) return;

    try {
      provider = await createAdProvider(ads);
    } catch {
      if (alive()) fail('Não foi possível carregar o anúncio.');
      return;
    }
    if (!alive()) { if (provider && provider.destroy) provider.destroy(); return; }
    if (!provider) { fail('Os anúncios não estão disponíveis.'); return; }

    // Limite para o provedor ter um anúncio PRONTO. Serve só para detectar indisponibilidade;
    // nunca libera o download como se o anúncio tivesse sido assistido.
    loadTimer = setTimeout(() => {
      if (alive() && state === 'loading') fail('O anúncio demorou demais para carregar.');
    }, ads.loadTimeoutMs || 10000);

    const guard = (fn) => (...args) => { if (alive()) fn(...args); };

    provider.request({
      sessionId,
      stage,
      onReady: guard((show) => {
        if (state !== 'loading') return;
        clearTimeout(loadTimer);
        showAd = show;
        state = 'ready';
        view({ message: 'Anúncio pronto. Ele só começa quando você clicar em "Assistir anúncio".', watch: true, watchEnabled: true, skip: true });
        watchBtn.focus();
      }),
      onGranted: guard(() => {
        if (state !== 'playing' && state !== 'ready') return;
        state = 'granted';
        if (ads.verification === 'server') verify(sessionId, alive);
        else unlock('ad');
      }),
      onClosed: guard(() => {
        if (state !== 'playing' && state !== 'ready') return; // fechar depois da recompensa é normal
        state = 'closed';
        view({ tone: 'warn', message: 'Você fechou o anúncio antes do fim, então o download não foi liberado.', retry: true, skip: true });
      }),
      onUnavailable: guard((reason) => fail(reason || 'Nenhum anúncio disponível agora.')),
      onError: guard((err) => fail((err && err.message) || 'O anúncio falhou.')),
    });
  }

  function watch() {
    if (state !== 'ready' || !showAd) return;
    const show = showAd;
    showAd = null;
    state = 'playing';
    view({ tone: 'busy', message: 'Anúncio em exibição…', watch: true });
    try { show(); } catch (e) { fail('O anúncio não pôde ser exibido.'); }
  }

  function verify(sessionId, alive) {
    state = 'verifying';
    view({ tone: 'busy', message: 'Confirmando o anúncio com o servidor…' });
    let tries = 0;
    const tick = async () => {
      if (!alive()) return;
      tries++;
      try {
        const res = await fetch(`/api/reward/status/${encodeURIComponent(sessionId)}`, { cache: 'no-store' });
        const body = await res.json();
        if (!alive()) return;
        if (body.granted) return unlock('ad');
      } catch { /* tenta de novo */ }
      if (tries >= 15) return fail('Não conseguimos confirmar o anúncio no servidor.');
      pollTimer = setTimeout(tick, 1000);
    };
    tick();
  }

  function fail(message) {
    const canRetry = ads && ads.provider !== 'lootlabs';
    clearTimeout(loadTimer);
    if (provider && provider.destroy) { try { provider.destroy(); } catch { /* ignora */ } }
    provider = null;
    showAd = null;
    state = 'failed';
    view({ tone: 'error', message: `${message} O download direto foi liberado, sem anúncio.`, file: true, retry: canRetry, cancel: 'Fechar' });
  }

  function unlock(mode) {
    clearTimeout(loadTimer);
    state = 'unlocked';
    const messages = {
      ad: 'Obrigado por apoiar o Voltix! Seu download está liberado.',
      skip: 'Download liberado.',
      disabled: 'Seu download está pronto.',
    };
    view({ tone: 'ok', message: messages[mode] || messages.disabled, file: true, cancel: 'Fechar' });
    fileLink.focus();
  }
}
