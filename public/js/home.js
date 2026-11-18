import { loadSite, formatDate, el, setText, initChrome } from './common.js';
import { getFileType } from './install.js';
import { initDownloadFlow } from './download-flow.js';

const ICONS = {
  bolt: '<path fill="currentColor" d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z"/>',
  cube: '<path fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" d="M12 2 3 7v10l9 5 9-5V7l-9-5Zm0 10L3 7m9 5 9-5m-9 5v10"/>',
  search: '<circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" stroke-width="2"/><path stroke="currentColor" stroke-width="2" stroke-linecap="round" d="m20 20-4-4"/>',
  shield: '<path fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" d="M12 2 4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5l-8-3Z"/><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" d="m8.5 12 2.5 2.5 4.5-5"/>',
  code: '<path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="m8 6-6 6 6 6m8-12 6 6-6 6"/>',
};

function icon(name) {
  return `<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">${ICONS[name] || ICONS.bolt}</svg>`;
}

async function main() {
  let data;
  try {
    data = await loadSite();
  } catch (e) {
    setText('[data-site="tagline"]', 'Não foi possível carregar as informações. Recarregue a página.');
    return;
  }
  const { site, current } = data;
  initChrome(data);

  if (site.title) setText('[data-site="title"]', site.title);
  setText('[data-site="tagline"]', site.tagline || '');
  setText('[data-site="description"]', site.description || '');

  // Pergunta frequente sobre a etapa antes do download (depende do provedor)
  const faqTexts = {
    lootlabs: 'O download passa por um link do LootLabs, que ajuda a manter o projeto. Lá podem aparecer tarefas de anunciantes antes do arquivo. Não instale programas nem ative notificações que você não reconheça.',
    gpt: 'Você pode assistir a um anúncio curto para apoiar o projeto. Ele só começa quando você aceita. Se não houver anúncio disponível, o download direto é liberado.',
    test: 'Você pode assistir a um anúncio curto para apoiar o projeto. Ele só começa quando você aceita. Se não houver anúncio disponível, o download direto é liberado.',
  };
  const faqText = faqTexts[data.ads && data.ads.provider];
  if (faqText) {
    const faq = document.querySelector('[data-faq="ads"]');
    faq.querySelector('[data-faq-text]').textContent = faqText;
    faq.hidden = false;
  }

  // Recursos (a seção só aparece se houver itens em config/site.json)
  const featureList = site.features || [];
  document.getElementById('recursos').hidden = !featureList.length;
  document.querySelectorAll('[data-features-link]').forEach((a) => { a.hidden = !featureList.length; });
  const features = document.getElementById('features');
  features.replaceChildren(...featureList.map((f) =>
    el('article', { class: 'feature' },
      el('div', { class: 'feature__icon', html: icon(f.icon) }),
      el('h3', {}, f.title || ''),
      el('p', {}, f.text || ''))));

  // Requisitos
  document.getElementById('requirements').replaceChildren(
    ...(site.requirements || []).map((r) => el('li', {}, r)));

  if (!current) {
    setText('[data-site="tagline"]', 'Nenhuma versão publicada ainda.');
    return;
  }

  const type = getFileType(current);
  setText('[data-current="version"]', `v${current.version}`);
  setText('[data-current="size"]', current.size || '—');
  setText('[data-current="date"]', formatDate(current.date));
  setText('[data-current="fileLabel"]', type.label);

  // Notas da versão atual
  document.getElementById('current-notes').replaceChildren(...current.notes.map((n) => el('li', {}, n)));
  document.getElementById('notes-block').hidden = !current.notes.length;

  // Instalação
  document.getElementById('install-intro').textContent = type.intro || '';
  document.getElementById('install-steps').replaceChildren(...type.steps.map((s) => el('li', { html: s })));
  const tip = document.getElementById('install-tip');
  if (type.tip) { tip.innerHTML = `<strong>Dica:</strong> ${type.tip}`; tip.hidden = false; }

  // Download
  const openBtn = document.getElementById('open-download');
  if (current.available) {
    openBtn.disabled = false;
    initDownloadFlow({ ads: data.ads, version: current, openButton: openBtn });
  } else {
    document.getElementById('download-unavailable').hidden = false;
  }
}

main();
