// Página para onde o LootLabs manda o visitante no fim das etapas.
// Mostra o botão que baixa a versão atual (config/versions.json).
import { loadSite, fileName, initChrome } from './common.js';

async function main() {
  const info = document.getElementById('info');
  const btn = document.getElementById('download');
  let data;
  try {
    data = await loadSite();
  } catch {
    info.textContent = 'Não foi possível carregar o download. Recarregue a página.';
    return;
  }
  initChrome(data);
  const v = data.current;
  if (!v || !v.available) {
    info.textContent = 'O arquivo ainda não está disponível. Tente novamente mais tarde.';
    return;
  }
  info.textContent = [`${v.name} v${v.version}`, fileName(v.url), v.size].filter(Boolean).join(' · ');
  btn.href = v.url;
  btn.setAttribute('download', fileName(v.url));
  btn.hidden = false;
  btn.addEventListener('click', () => { document.getElementById('after').hidden = false; });
}

main();
