'use strict';
/**
 * Verificação da recompensa NO SERVIDOR (SSV — server-side verification).
 *
 * Fluxo:
 *  1. O navegador cria uma sessão (POST /api/reward/session) e passa o sessionId ao provedor
 *     como "custom data" / "user id" do anúncio.
 *  2. Quando o visitante termina o anúncio, o PROVEDOR chama
 *     /api/reward/callback/<provedor> no seu servidor, com o sessionId e uma assinatura.
 *  3. Esta função valida a assinatura e devolve o sessionId. O servidor marca a sessão como
 *     recompensada e o navegador (que consulta /api/reward/status/<id>) libera o botão.
 *
 * Retorne o sessionId se o callback for legítimo; lance um erro caso contrário.
 */
const crypto = require('node:crypto');

function timingSafeEqualHex(a, b) {
  const ba = Buffer.from(String(a), 'hex');
  const bb = Buffer.from(String(b), 'hex');
  return ba.length === bb.length && ba.length > 0 && crypto.timingSafeEqual(ba, bb);
}

function verifyRewardCallback({ provider, activeProvider, url, body, headers }) {
  if (provider !== activeProvider) throw new Error('provedor não está ativo');

  switch (provider) {
    /* -------------------------------------------------------------- */
    /* Modo de teste: o "provedor" falso do navegador chama esta rota. */
    /* Só funciona com AD_PROVIDER=test.                               */
    /* -------------------------------------------------------------- */
    case 'test': {
      let data;
      try { data = JSON.parse(body || '{}'); } catch { throw new Error('JSON inválido'); }
      if (typeof data.sessionId !== 'string') throw new Error('sessionId ausente');
      return data.sessionId;
    }

    /* -------------------------------------------------------------- */
    /* >>> INTEGRAÇÃO REAL (SSV)                                       */
    /* Modelo genérico com HMAC-SHA256. Cada provedor tem seu próprio   */
    /* formato (nomes dos parâmetros, algoritmo, chaves públicas…).     */
    /* Copie este bloco, troque "meu-provedor" pelo valor de            */
    /* AD_PROVIDER e siga a documentação do provedor escolhido.         */
    /* -------------------------------------------------------------- */
    case 'meu-provedor': {
      const secret = process.env.AD_SSV_SECRET;
      if (!secret) throw new Error('AD_SSV_SECRET não configurado');
      const sessionId = url.searchParams.get('custom_data');
      const signature = url.searchParams.get('signature');
      if (!sessionId || !signature) throw new Error('parâmetros ausentes');
      const expected = crypto.createHmac('sha256', secret).update(sessionId).digest('hex');
      if (!timingSafeEqualHex(signature, expected)) throw new Error('assinatura inválida');
      return sessionId;
    }

    default:
      throw new Error('provedor sem verificação no servidor');
  }
}

module.exports = { verifyRewardCallback };
