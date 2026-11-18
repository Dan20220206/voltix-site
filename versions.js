import { loadSite, formatDate, el, initChrome } from './common.js';
import { getFileType } from './install.js';

async function main() {
  const root = document.getElementById('releases');
  let data;
  try {
    data = await loadSite();
  } catch {
    root.replaceChildren(el('p', { class: 'notice' }, 'Não foi possível carregar o histórico. Recarregue a página.'));
    return;
  }
  initChrome(data);
  const { versions, current } = data;
  if (!versions.length) {
    root.replaceChildren(el('p', { class: 'muted' }, 'Nenhuma versão publicada ainda.'));
    return;
  }

  root.replaceChildren(...versions.map((v) => {
    const isCurrent = current && v.version === current.version;
    const meta = [formatDate(v.date), getFileType(v).label, v.size].filter(Boolean).join(' · ');
    return el('article', { class: `release${isCurrent ? ' release--current' : ''}`, id: `v${v.version}` },
      el('div', { class: 'release__head' },
        el('h2', {}, `${v.name} ${v.version}`),
        isCurrent ? el('span', { class: 'tag' }, 'Atual') : null,
        el('span', { class: 'release__meta' }, meta)),
      v.notes.length ? el('ul', { class: 'notes' }, v.notes.map((n) => el('li', {}, n))) : null,
      isCurrent
        ? el('a', { class: 'btn btn--primary', href: '/#conteudo' }, 'Baixar na página inicial')
        : (v.available
          ? el('a', { class: 'link', href: v.url, download: '' }, 'Baixar esta versão (sem anúncio)')
          : el('p', { class: 'muted small' }, 'Arquivo desta versão não está mais disponível.')));
  }));

  if (location.hash) document.querySelector(location.hash)?.scrollIntoView();
}

main();
