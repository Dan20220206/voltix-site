// Instruções de instalação por tipo de arquivo (campo "fileType" em config/versions.json).
// Uma versão pode substituir os passos com o campo "installSteps": ["passo 1", "passo 2", ...].

export const FILE_TYPES = {
  exe: {
    label: 'Programa (.exe)',
    intro: 'O Voltix é um programa para Windows.',
    steps: [
      'Baixe o arquivo <code>.exe</code> pelo botão <strong>Baixar Voltix</strong>.',
      'Abra a pasta <strong>Downloads</strong> do seu computador e dê dois cliques no arquivo.',
      'Se o Windows mostrar "O Windows protegeu o computador", é porque o programa ainda não tem assinatura digital. Só continue se você baixou pelo site oficial do Voltix: clique em <strong>Mais informações</strong> e depois em <strong>Executar assim mesmo</strong>.',
      'Siga as instruções que aparecerem na tela.',
    ],
    tip: 'Baixe o Voltix só por este site. Cópias enviadas por outras pessoas podem ter sido alteradas.',
  },
  rbxmx: {
    label: 'Modelo (.rbxmx)',
    intro: 'O arquivo é um modelo do Roblox Studio para inserir no seu place.',
    steps: [
      'Baixe o arquivo <code>.rbxmx</code>.',
      'Abra o place no Roblox Studio e deixe a janela <strong>Explorer</strong> visível.',
      'Clique com o botão direito no serviço onde ele deve ficar (por exemplo <code>ReplicatedStorage</code>) e escolha <strong>Insert from File…</strong>.',
      'Selecione o arquivo baixado e confirme.',
    ],
  },
  rbxm: {
    label: 'Modelo (.rbxm)',
    intro: 'O arquivo é um modelo do Roblox Studio para inserir no seu place.',
    steps: [
      'Baixe o arquivo <code>.rbxm</code>.',
      'Abra o place no Roblox Studio e deixe a janela <strong>Explorer</strong> visível.',
      'Clique com o botão direito no serviço onde ele deve ficar (por exemplo <code>ReplicatedStorage</code>) e escolha <strong>Insert from File…</strong>.',
      'Selecione o arquivo baixado e confirme.',
    ],
  },
  luau: {
    label: 'Script (.luau)',
    intro: 'O arquivo é um código Luau para colar no Roblox Studio.',
    steps: [
      'Baixe o arquivo <code>.luau</code> e abra em um editor de texto (Bloco de Notas, VS Code…).',
      'Copie todo o conteúdo.',
      'No Roblox Studio, crie um <strong>ModuleScript</strong> em <code>ReplicatedStorage</code> e renomeie para <code>Voltix</code>.',
      'Apague o conteúdo padrão do ModuleScript e cole o código.',
      'Use nos seus scripts com <code>local Voltix = require(game.ReplicatedStorage.Voltix)</code>.',
    ],
  },
  zip: {
    label: 'Pacote (.zip)',
    intro: 'O arquivo vem compactado com vários arquivos.',
    steps: [
      'Baixe o arquivo <code>.zip</code>.',
      'Clique com o botão direito no arquivo e escolha <strong>Extrair tudo</strong>.',
      'Para cada arquivo <code>.rbxm</code>/<code>.rbxmx</code>, use <strong>Insert from File…</strong> no Explorer do Roblox Studio.',
    ],
  },
};

export function getFileType(version) {
  const key = String(version?.fileType || '').toLowerCase();
  const base = FILE_TYPES[key] || {
    label: key ? `.${key}` : 'Arquivo',
    intro: 'Siga as instruções que acompanham o arquivo.',
    steps: ['Baixe o arquivo pelo botão <strong>Baixar Voltix</strong>.'],
  };
  if (Array.isArray(version?.installSteps) && version.installSteps.length) {
    return { ...base, steps: version.installSteps, tip: version.installTip || base.tip };
  }
  return base;
}
