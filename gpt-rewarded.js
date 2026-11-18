// >>> INTEGRAÇÃO REAL: Google Ad Manager — anúncio com recompensa na web (GPT "rewarded").
//
// Ativação (no servidor, nada de credencial aqui):
//   AD_PROVIDER=gpt
//   GPT_AD_UNIT_PATH=/<código da rede>/<bloco de anúncio rewarded>
//
// Eventos oficiais usados (biblioteca GPT):
//   rewardedSlotReady   -> há anúncio; makeRewardedVisible() só é chamado após o clique do visitante
//   rewardedSlotGranted -> o Google confirmou a recompensa (é isto que libera o download)
//   rewardedSlotClosed  -> o visitante fechou o anúncio
//   slotRenderEnded     -> isEmpty = sem anúncio para exibir
//
// O Ad Manager não oferece verificação no servidor (SSV) para rewarded na web, por isso o servidor
// envia verification: "client" para este provedor e a confirmação vem de rewardedSlotGranted.

const GPT_SRC = 'https://securepubads.g.doubleclick.net/tag/js/gpt.js';

let scriptPromise = null;
let listenersBound = false;
let active = null; // { slot, handlers }

function loadGpt() {
  if (scriptPromise) return scriptPromise;
  window.googletag = window.googletag || { cmd: [] };
  scriptPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = GPT_SRC;
    s.async = true;
    s.crossOrigin = 'anonymous';
    s.onload = resolve;
    s.onerror = () => {
      scriptPromise = null;
      s.remove();
      reject(new Error('Não foi possível carregar o anúncio (talvez um bloqueador de anúncios esteja ativo).'));
    };
    document.head.appendChild(s);
  });
  return scriptPromise;
}

function bindListeners() {
  if (listenersBound) return;
  listenersBound = true;
  const pubads = window.googletag.pubads();
  const mine = (e) => active && e.slot === active.slot;

  pubads.addEventListener('rewardedSlotReady', (e) => {
    if (mine(e)) active.handlers.onReady(() => e.makeRewardedVisible());
  });
  pubads.addEventListener('rewardedSlotGranted', (e) => {
    if (mine(e)) active.handlers.onGranted(e.payload);
  });
  pubads.addEventListener('rewardedSlotClosed', (e) => {
    if (!mine(e)) return;
    const { handlers, slot } = active;
    handlers.onClosed();
    window.googletag.destroySlots([slot]);
    if (active && active.slot === slot) active = null;
  });
  pubads.addEventListener('slotRenderEnded', (e) => {
    if (mine(e) && e.isEmpty) active.handlers.onUnavailable('Nenhum anúncio disponível agora.');
  });
}

export function createGptRewardedProvider(ads) {
  return {
    name: 'gpt',

    request(handlers) {
      if (!ads.adUnitPath) {
        handlers.onUnavailable('O bloco de anúncio não foi configurado.');
        return;
      }
      loadGpt().then(() => {
        window.googletag.cmd.push(() => {
          const gt = window.googletag;
          bindListeners();
          const slot = gt.defineOutOfPageSlot(ads.adUnitPath, gt.enums.OutOfPageFormat.REWARDED);
          if (!slot) {
            // A biblioteca devolve null quando a página/dispositivo não suporta o formato.
            handlers.onUnavailable('Este navegador não suporta o anúncio com recompensa.');
            return;
          }
          slot.addService(gt.pubads());
          active = { slot, handlers };
          gt.enableServices();
          gt.display(slot);
        });
      }, (err) => handlers.onError(err));
    },

    destroy() {
      if (active && window.googletag && window.googletag.destroySlots) {
        try { window.googletag.destroySlots([active.slot]); } catch { /* ignora */ }
      }
      active = null;
    },
  };
}
