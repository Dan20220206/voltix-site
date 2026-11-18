# Site do Voltix

Site de downloads do **Voltix** (ferramentas Luau para criadores do Roblox Studio). Funciona no celular e no PC. O download é grátis, sem cadastro e sem key.

- Servidor Node.js **sem dependências** (não precisa de `npm install`)
- Versões e textos em arquivos JSON. Você troca o arquivo e publica sem mexer na interface.
- Anúncio pelo **LootLabs** (padrão), ou anúncio com recompensa do Google Ad Manager, ou nenhum
- Credenciais só em variáveis de ambiente (`.env`), nunca em `public/`

```
voltix-site/
├─ server.js                      servidor + API
├─ reward-verification.js         verificação no servidor (só para anúncio com recompensa)
├─ config/
│  ├─ versions.json               versões publicadas + link do LootLabs ← você edita
│  └─ site.json                   textos, recursos e requisitos ← você edita
├─ downloads/                     arquivos para download ← você coloca aqui
├─ public/                        páginas, CSS, JS e logo (tudo é público)
└─ .env.example                   modelo de configuração
```

---

## 1. Rodar no seu PC

Requisito: **Node.js 18 ou mais novo** ([nodejs.org](https://nodejs.org)).

```bash
cd voltix-site
```

```bash
npm start
```

Abra <http://localhost:3000> no navegador. Enquanto o link do LootLabs não estiver configurado, o botão **Baixar Voltix** avisa isso e libera o download direto.

---

## 2. Colocar o site no ar (Render, grátis)

1. Crie uma conta no [GitHub](https://github.com) e crie um repositório novo.
2. Envie **o conteúdo** da pasta `voltix-site` (não a pasta em si) em **Add file → Upload files**. O `.env` não deve ir junto.
3. Crie uma conta no [Render](https://render.com), clique em **New → Web Service** e escolha o repositório.
4. Preencha:
   - **Build Command:** deixe vazio
   - **Start Command:** `npm start`
   - **Plano:** Free
5. Clique em **Create Web Service**. Em alguns minutos o Render mostra o endereço do site, por exemplo `https://voltix-xxxx.onrender.com`.

No plano grátis, o site "dorme" quando ninguém acessa e a primeira visita depois disso demora alguns segundos. Para usar um domínio próprio, vá em **Settings → Custom Domain**.

Sempre que você enviar arquivos novos para o GitHub, o Render atualiza o site sozinho.

---

## 3. Colocar o LootLabs

O LootLabs é um "link locker": o visitante clica em **Baixar Voltix**, vê um aviso, clica em **Continuar para o LootLabs** e vai para o loot-link.com em outra aba. Lá ele passa pelas tarefas de anunciantes, e no fim o LootLabs leva ele ao arquivo.

> O conteúdo das tarefas é controlado pelo LootLabs, não pelo seu site. O aviso na janela de download e na página de privacidade explica isso ao visitante.

**Passo a passo** (o site precisa estar no ar antes):

1. Copie o endereço público do arquivo. Exemplo:
   `https://voltix-xxxx.onrender.com/downloads/Voltix-1.0.0.exe`
2. No painel do [LootLabs](https://lootlabs.gg), crie um link novo usando esse endereço como destino e escolha quantas tarefas quer.
3. Copie o link gerado (algo como `https://loot-link.com/s?xxxx`).
4. Cole em `config/versions.json`, no campo `lootlabsUrl` da versão:
   ```json
   "lootlabsUrl": "https://loot-link.com/s?xxxx"
   ```
5. Envie o `versions.json` atualizado para o GitHub.

Pronto. O botão já usa o LootLabs, porque `AD_PROVIDER=lootlabs` é o padrão. Se `lootlabsUrl` estiver vazio, o site avisa e libera o download direto, para nunca travar o visitante.

**Cada versão nova precisa de um link novo no LootLabs**, apontando para o arquivo novo.

---

## 4. Publicar uma nova versão

1. Coloque o arquivo em `downloads/`, por exemplo `downloads/Voltix-1.1.0.exe`.
2. Em `config/versions.json`, adicione um item **no topo** da lista e mude `current`:

```json
{
  "current": "1.1.0",
  "versions": [
    {
      "name": "Voltix",
      "version": "1.1.0",
      "date": "2026-12-01",
      "size": "",
      "fileType": "exe",
      "url": "/downloads/Voltix-1.1.0.exe",
      "lootlabsUrl": "https://loot-link.com/s?xxxx",
      "notes": [
        "O que mudou nesta versão."
      ]
    }
  ]
}
```

3. Envie para o GitHub. Rodando no seu PC, basta salvar, sem reiniciar.

| Campo | Para que serve |
|---|---|
| `current` | Versão mostrada na página inicial. Se faltar, usa a de data mais recente. |
| `name` | Nome exibido (padrão "Voltix"). |
| `version` | Número da versão. |
| `date` | Data no formato `AAAA-MM-DD`. |
| `size` | Deixe `""` para o servidor calcular sozinho. Para URL externa, escreva, por exemplo, `"2,4 MB"`. |
| `fileType` | Define as instruções de instalação: `exe`, `rbxmx`, `rbxm`, `luau` ou `zip`. |
| `url` | `/downloads/arquivo.ext` ou um link externo. Use `null` em versões antigas sem arquivo. |
| `lootlabsUrl` | Link do LootLabs desta versão. |
| `notes` | Lista com as notas da atualização. Se ficar vazia, a seção some da página. |
| `installSteps` | *(opcional)* lista de passos próprios, que substitui as instruções padrão do tipo. |

Os textos da página ficam em `config/site.json`. Se `features` (recursos) ou `description` estiverem vazios, essas partes não aparecem. Exemplo de recurso:

```json
"features": [
  { "icon": "bolt", "title": "Nome do recurso", "text": "O que ele faz." }
]
```
Ícones disponíveis: `bolt`, `cube`, `search`, `shield`, `code`.

---

## 5. Outros modos de anúncio

Defina `AD_PROVIDER` no `.env` (no PC) ou em **Environment** no Render:

| Valor | O que faz |
|---|---|
| `lootlabs` | Padrão. Usa o `lootlabsUrl` de cada versão. |
| `none` | Sem anúncio: o botão baixa direto. |
| `test` | Modo de teste do anúncio com recompensa (anúncio falso, sem conta). |
| `gpt` | Anúncio com recompensa do Google Ad Manager. Precisa também de `GPT_AD_UNIT_PATH`. |

Os pontos do código para integrar outro provedor estão marcados com **`>>> INTEGRAÇÃO REAL`**.

---

## 6. Arquivo .exe
- Coloque o programa em `downloads/` com o nome `Voltix-1.0.0.exe` (ou o nome que estiver em `url` no `versions.json`). Enquanto o arquivo não existir, o botão **Baixar Voltix** fica desativado.
- **Limite do GitHub:** pelo site do GitHub dá para enviar arquivos de até 25 MB, e o Git recusa arquivos acima de 100 MB. Se o `.exe` for maior, publique em **GitHub Releases** (no repositório: **Releases → Create a new release**, anexe o `.exe`). Depois, use o link do arquivo da release no campo `url` e escreva o tamanho em `size`, por exemplo `"48 MB"`.
- **Aviso do Windows (SmartScreen):** programas sem assinatura digital mostram "O Windows protegeu o computador". Para o aviso sumir, assine o `.exe` com um certificado de assinatura de código.
- **Antes de publicar cada versão**, envie o `.exe` ao [VirusTotal](https://www.virustotal.com) e confira se ele está limpo. Gere o `.exe` num computador sem vírus, porque um PC infectado pode infectar o programa que você distribui.

## 7. Observações
- O endereço `/downloads/...` é público. Quem souber o endereço consegue baixar sem passar pelo LootLabs.
- Revise `public/privacidade.html` com base na LGPD.
