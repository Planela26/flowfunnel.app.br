/* FlowFunnel — script oficial de conversão para PÁGINA DE OBRIGADO
 * Uso:
 *   <script src="https://SEU-SAAS.com/flowfunnel-conversion.js"
 *           data-site="SEU_SITE_ID"
 *           data-platform="hotmart"          (opcional)
 *           data-value="197.00"              (opcional — pode vir da URL)
 *           data-product="Nome do Produto">  (opcional)
 *   </script>
 *
 * O script lê o lead_id do localStorage (persistido pelo tracker.js na landing
 * page) e o order_id/valor da URL da thank-you page (parâmetros comuns das
 * plataformas), enviando a conversão para a FlowFunnel. Isso cria o vínculo
 * DETERMINÍSTICO entre a venda e o clique original.
 */
(function () {
  'use strict';

  var script =
    document.currentScript ||
    (function () {
      var s = document.getElementsByTagName('script');
      return s[s.length - 1];
    })();
  if (!script) return;

  var siteId = script.getAttribute('data-site');
  if (!siteId) {
    if (window && window.console) console.warn('[zfConversion] data-site ausente');
    return;
  }

  var apiBase = script.getAttribute('data-api');
  if (!apiBase) {
    try {
      apiBase = new URL(script.src).origin;
    } catch (e) {
      apiBase = window.location.origin;
    }
  }

  function safeGet(key) {
    try {
      return window.localStorage.getItem(key);
    } catch (e) {
      return null;
    }
  }

  var qs;
  try {
    qs = new URLSearchParams(window.location.search);
  } catch (e) {
    qs = { get: function () { return null; } };
  }

  // lead_id: localStorage (mesmo domínio da landing) OU parâmetro na URL da
  // thank-you page (quando propagado pelo checkout).
  var leadId =
    safeGet('lead_id') ||
    qs.get('lead_id') ||
    qs.get('sck') ||
    qs.get('s1') ||
    null;
  if (!leadId) {
    if (window && window.console) console.warn('[zfConversion] lead_id não encontrado — conversão será registrada sem vínculo');
    leadId = 'unknown_' + Date.now().toString(36);
  }

  // order_id: atributo do script ou parâmetros comuns das plataformas.
  var orderId =
    script.getAttribute('data-order') ||
    qs.get('order_id') ||
    qs.get('transaction') || // Hotmart
    qs.get('trans_cod') ||   // Eduzz
    qs.get('sale_id') ||     // Perfect Pay
    qs.get('pedido') ||      // Monetizze
    null;

  var value = Number(script.getAttribute('data-value') || qs.get('value') || qs.get('amount') || 0) || 0;
  var product = script.getAttribute('data-product') || qs.get('product') || null;
  var platform = script.getAttribute('data-platform') || qs.get('platform') || null;
  var currency = script.getAttribute('data-currency') || 'BRL';

  var body = JSON.stringify({
    site: siteId,
    lead_id: leadId,
    visitor_id: safeGet('zf_visitor_id') || null,
    order_id: orderId,
    platform: platform,
    value: value,
    currency: currency,
    product: product,
    source: 'thank_you_page',
    meta: { url: window.location.href, ts: Date.now() },
  });

  // Dedup por sessão: evita duplicar em refresh da thank-you page.
  var dedupKey = 'zf_conv_' + (orderId || leadId);
  try {
    if (window.sessionStorage.getItem(dedupKey)) return;
    window.sessionStorage.setItem(dedupKey, '1');
  } catch (e) {}

  var url = apiBase.replace(/\/$/, '') + '/api/track/conversion';
  try {
    if (navigator.sendBeacon) {
      navigator.sendBeacon(url, new Blob([body], { type: 'application/json' }));
    } else {
      fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body,
        keepalive: true,
        mode: 'cors',
      }).catch(function () {});
    }
  } catch (e) {}
})();
