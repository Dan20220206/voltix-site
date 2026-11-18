'use strict';
/**
 * Servidor do site Voltix — sem dependências (Node 18+).
 *
 *  - Serve as páginas de /public
 *  - Serve os arquivos de /downloads como anexo
 *  - GET  /api/site                       textos + versões + configuração PÚBLICA de anúncios
 *  - POST /api/reward/session             cria uma sessão de recompensa (id aleatório)
 *  - GET|POST /api/reward/callback/:prov  callback de verificação no servidor (SSV) do provedor
 *  - GET  /api/reward/status/:id          o navegador consulta se o servidor confirmou a recompensa
 *
 * Credenciais ficam em variáveis de ambiente / arquivo .env (nunca em /public).
 */
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const ROOT = __dirname;
loadEnv(path.join(ROOT, '.env'));

const { verifyRewardCallback } = require('./reward-verification');

const PORT = Number(process.env.PORT) || 3000;
const AD_PROVIDER = (process.env.AD_PROVIDER || 'lootlabs').trim().toLowerCase();
const PUBLIC_DIR = path.join(ROOT, 'public');
const DOWNLOADS_DIR = path.join(ROOT, 'downloads');
const SITE_FILE = path.join(ROOT, 'config', 'site.json');
const VERSIONS_FILE = path.join(ROOT, 'config', 'versions.json');

const SESSION_TTL_MS = 30 * 60 * 1000;
const MAX_SESSIONS = 20000;
const sessions = new Map(); // id -> { created, granted }

/* ------------------------------------------------------------------ */
/* Utilidades                                                          */
/* ------------------------------------------------------------------ */

function loadEnv(file) {
  if (!fs.existsSync(file)) return;
  for (const raw of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return '';
  const fmt = (n) => n.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${fmt(bytes / 1024)} KB`;
  return `${fmt(bytes / (1024 * 1024))} MB`;
}

/** Caminho local de um arquivo em /downloads, ou null se a URL for externa/inválida. */
function localDownloadPath(url) {
  if (typeof url !== 'string' || !url.startsWith('/downloads/')) return null;
  let rel;
  try { rel = decodeURIComponent(url.slice('/downloads/'.length)); } catch { return null; }
  const full = path.resolve(DOWNLOADS_DIR, rel);
  if (!full.startsWith(DOWNLOADS_DIR + path.sep)) return null;
  return full;
}

/** Lê config/versions.json a cada requisição: basta salvar o arquivo para publicar. */
function loadVersions() {
  const data = readJson(VERSIONS_FILE);
  const list = Array.isArray(data.versions) ? data.versions : [];
  const versions = list
    .map((v) => {
      const out = { ...v };
      out.name = out.name || 'Voltix';
      out.notes = Array.isArray(out.notes) ? out.notes : (out.notes ? [String(out.notes)] : []);
      const local = localDownloadPath(out.url);
      out.available = Boolean(out.url) && (local ? fs.existsSync(local) : true);
      if (!out.size && local && out.available) out.size = formatBytes(fs.statSync(local).size);
      return out;
    })
    .sort((a, b) => String(b.date).localeCompare(String(a.date)));
  const current = versions.find((v) => v.version === data.current) || versions[0] || null;
  return { current, versions };
}

/** Somente o que pode ir para o navegador. Segredos (ex.: AD_SSV_SECRET) nunca entram aqui. */
function publicAdConfig() {
  const common = { allowSkip: process.env.AD_ALLOW_SKIP === 'true' };
  switch (AD_PROVIDER) {
    case 'test':
      return { ...common, provider: 'test', testMode: true, verification: 'server' };
    case 'gpt':
      return {
        ...common,
        provider: 'gpt',
        testMode: false,
        // Google Ad Manager não oferece verificação no servidor para rewarded na web:
        // a confirmação oficial é o evento rewardedSlotGranted da própria biblioteca GPT.
        verification: 'client',
        adUnitPath: process.env.GPT_AD_UNIT_PATH || '',
        loadTimeoutMs: Number(process.env.AD_LOAD_TIMEOUT_MS) || 10000,
      };
    case 'lootlabs':
      // LootLabs é um "link locker": o visitante vai para o loot-link.com e o próprio LootLabs
      // leva ao arquivo no fim. O link de cada versão fica em "lootlabsUrl" no config/versions.json.
      return { ...common, provider: 'lootlabs', testMode: false, verification: 'none' };
    case 'none':
      return { ...common, provider: 'none', testMode: false };
    default:
      // >>> INTEGRAÇÃO REAL: ao criar um novo provedor, acrescente um "case" aqui
      //     com os dados públicos que o script do navegador precisa.
      console.warn(`[voltix] AD_PROVIDER desconhecido: "${AD_PROVIDER}". Anúncios desativados.`);
      return { ...common, provider: 'none', testMode: false };
  }
}

function cleanupSessions() {
  const now = Date.now();
  for (const [id, s] of sessions) if (now - s.created > SESSION_TTL_MS) sessions.delete(id);
}
setInterval(cleanupSessions, 60 * 1000).unref();

/* ------------------------------------------------------------------ */
/* HTTP                                                                */
/* ------------------------------------------------------------------ */

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
};

function baseHeaders(extra = {}) {
  return {
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    ...extra,
  };
}

function sendJson(res, status, body) {
  res.writeHead(status, baseHeaders({ 'Content-Type': MIME['.json'], 'Cache-Control': 'no-store' }));
  res.end(JSON.stringify(body));
}

function readBody(req, limit = 16 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) { reject(new Error('corpo muito grande')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function serveFile(res, file, { attachment = false, req } = {}) {
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) return notFound(res);
    const ext = path.extname(file).toLowerCase();
    const headers = baseHeaders({
      'Content-Type': attachment ? 'application/octet-stream' : (MIME[ext] || 'application/octet-stream'),
      'Content-Length': st.size,
      // Imagens podem ficar em cache; HTML/CSS/JS e downloads sempre revalidam (atualizações aparecem na hora).
      'Cache-Control': ['.webp', '.png', '.jpg', '.svg', '.ico'].includes(ext) && !attachment ? 'public, max-age=86400' : 'no-cache',
    });
    if (attachment) {
      const name = path.basename(file);
      headers['Content-Disposition'] = `attachment; filename="${name.replace(/"/g, '')}"; filename*=UTF-8''${encodeURIComponent(name)}`;
    }
    res.writeHead(200, headers);
    if (req && req.method === 'HEAD') return res.end();
    fs.createReadStream(file).pipe(res);
  });
}

function notFound(res) {
  const page = path.join(PUBLIC_DIR, '404.html');
  if (fs.existsSync(page)) {
    res.writeHead(404, baseHeaders({ 'Content-Type': MIME['.html'] }));
    fs.createReadStream(page).pipe(res);
  } else {
    res.writeHead(404, baseHeaders({ 'Content-Type': MIME['.txt'] }));
    res.end('Não encontrado');
  }
}

function safeJoin(dir, urlPath) {
  let decoded;
  try { decoded = decodeURIComponent(urlPath); } catch { return null; }
  const full = path.resolve(dir, '.' + path.posix.normalize('/' + decoded));
  if (full !== dir && !full.startsWith(dir + path.sep)) return null;
  return full;
}

async function handleApi(req, res, url) {
  const p = url.pathname;

  if (p === '/api/site' && req.method === 'GET') {
    try {
      const site = readJson(SITE_FILE);
      const { current, versions } = loadVersions();
      return sendJson(res, 200, { site, current, versions, ads: publicAdConfig() });
    } catch (e) {
      console.error('[voltix] erro ao ler config/*.json:', e.message);
      return sendJson(res, 500, { error: 'Configuração inválida. Verifique config/site.json e config/versions.json.' });
    }
  }

  if (p === '/api/reward/session' && req.method === 'POST') {
    if (sessions.size >= MAX_SESSIONS) cleanupSessions();
    if (sessions.size >= MAX_SESSIONS) return sendJson(res, 503, { error: 'Tente novamente em instantes.' });
    const id = crypto.randomBytes(18).toString('base64url');
    sessions.set(id, { created: Date.now(), granted: false });
    return sendJson(res, 200, { sessionId: id });
  }

  const status = p.match(/^\/api\/reward\/status\/([A-Za-z0-9_-]{10,64})$/);
  if (status && req.method === 'GET') {
    const s = sessions.get(status[1]);
    if (!s) return sendJson(res, 404, { granted: false, error: 'Sessão expirada ou inexistente.' });
    return sendJson(res, 200, { granted: s.granted });
  }

  const cb = p.match(/^\/api\/reward\/callback\/([a-z0-9-]{1,32})$/);
  if (cb && (req.method === 'GET' || req.method === 'POST')) {
    let body = '';
    try { body = req.method === 'POST' ? await readBody(req) : ''; } catch { return sendJson(res, 413, { ok: false }); }
    let sessionId;
    try {
      sessionId = verifyRewardCallback({ provider: cb[1], activeProvider: AD_PROVIDER, url, body, headers: req.headers });
    } catch (e) {
      console.warn(`[voltix] callback recusado (${cb[1]}): ${e.message}`);
      return sendJson(res, 403, { ok: false });
    }
    const s = sessions.get(sessionId);
    if (!s) return sendJson(res, 404, { ok: false });
    s.granted = true;
    return sendJson(res, 200, { ok: true });
  }

  return sendJson(res, 404, { error: 'Rota não encontrada.' });
}

const server = http.createServer(async (req, res) => {
  let url;
  try { url = new URL(req.url, 'http://localhost'); } catch { res.writeHead(400); return res.end(); }

  try {
    if (url.pathname.startsWith('/api/')) return await handleApi(req, res, url);

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405, baseHeaders()); return res.end();
    }

    if (url.pathname.startsWith('/downloads/')) {
      const file = localDownloadPath(url.pathname);
      return file ? serveFile(res, file, { attachment: true, req }) : notFound(res);
    }

    let pathname = url.pathname;
    if (pathname.endsWith('/')) pathname += 'index.html';
    else if (!path.extname(pathname)) pathname += '.html'; // /versoes -> versoes.html
    const file = safeJoin(PUBLIC_DIR, pathname);
    if (!file) return notFound(res);
    return serveFile(res, file, { req });
  } catch (e) {
    console.error('[voltix] erro:', e);
    if (!res.headersSent) sendJson(res, 500, { error: 'Erro interno.' });
  }
});

server.listen(PORT, () => {
  const ads = publicAdConfig();
  console.log(`Voltix rodando em http://localhost:${PORT}`);
  console.log(`Provedor de anúncios: ${ads.provider}${ads.testMode ? ' (MODO DE TESTE)' : ''}`);
  if (ads.provider === 'gpt' && !ads.adUnitPath) console.warn('[voltix] GPT_AD_UNIT_PATH não definido: o anúncio ficará indisponível.');
});
