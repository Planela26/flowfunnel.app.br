/* FlowSara — tracker público de landing pages
 * Uso:
 *   <script src="https://SEU-SAAS.com/tracker.js" data-site="SEU_SITE_ID"></script>
 *
 * Captura UTMs + click IDs (fbclid/gclid/ttclid/msclkid), gera visitor_id,
 * session_id e lead_id persistentes, dispara page_view automático, marca
 * cliques em links de WhatsApp / checkout e injeta lead_id na URL de checkout
 * (usando o parâmetro nativo de tracking de cada plataforma quando existir).
 * Não interfere em nenhum tracker existente.
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
    if (window && window.console) console.warn('[zfTracker] data-site ausente');
    return;
  }

  // Endpoint da API: por padrão usa o origin do script
  var apiBase = script.getAttribute('data-api');
  if (!apiBase) {
    try {
      apiBase = new URL(script.src).origin;
    } catch (e) {
      apiBase = window.location.origin;
    }
  }

  var debug = script.getAttribute('data-debug') === 'true';
  var log = function () {
    if (debug && window.console) console.log.apply(console, ['[zfTracker]'].concat([].slice.call(arguments)));
  };

  function uuid(prefix) {
    return (
      (prefix || 'l_') +
      Date.now().toString(36) +
      '_' +
      Math.random().toString(36).slice(2, 10) +
      Math.random().toString(36).slice(2, 6)
    );
  }

  function safeGet(key) {
    try {
      return window.localStorage.getItem(key);
    } catch (e) {
      return null;
    }
  }
  function safeSet(key, value) {
    try {
      window.localStorage.setItem(key, value);
    } catch (e) {}
  }

  // Captura UTMs + click IDs da URL atual e persiste
  var UTM_KEYS = ['utm_source', 'utm_campaign', 'utm_medium', 'utm_content', 'utm_term'];
  var CLICK_ID_KEYS = ['fbclid', 'gclid', 'ttclid', 'msclkid'];
  try {
    var qs = new URLSearchParams(window.location.search);
    UTM_KEYS.concat(CLICK_ID_KEYS).forEach(function (k) {
      var v = qs.get(k);
      if (v) safeSet(k, v);
    });
  } catch (e) {}

  // Referrer externo: persiste o primeiro referrer conhecido
  try {
    if (document.referrer && !safeGet('zf_first_referrer')) {
      var refHost = new URL(document.referrer).hostname;
      if (refHost !== window.location.hostname) safeSet('zf_first_referrer', document.referrer);
    }
  } catch (e) {}

  function getUtms() {
    var out = {};
    UTM_KEYS.forEach(function (k) {
      var v = safeGet(k);
      if (v) out[k] = v;
    });
    return out;
  }
  function getClickIds() {
    var out = {};
    CLICK_ID_KEYS.forEach(function (k) {
      var v = safeGet(k);
      if (v) out[k] = v;
    });
    return out;
  }

  // Identidade vinda do link rastreável (/r/<slug>).
  //
  // Quando a visita chega pelo link do FlowSara, o servidor JÁ registrou o
  // clique e gerou lead_id, visitor_id e session_id — e os manda na URL. Adotar
  // esses valores em vez de gerar outros é o que faz os dois métodos se
  // somarem: o link garante a origem, e o tracker, usando o MESMO lead_id,
  // fecha a atribuição da venda mais adiante (o lead_id vai para o link de
  // checkout, volta no webhook da plataforma e casa com o clique).
  //
  // Sem isto, cada método criaria um lead diferente para a mesma pessoa: a
  // origem ficaria num, a venda no outro, e nenhum dos dois contaria a história
  // inteira.
  var linkParams = null;
  try {
    linkParams = new URLSearchParams(window.location.search);
  } catch (e) {}
  function doLink(nome) {
    if (!linkParams) return null;
    var v = linkParams.get(nome);
    return v && v.length < 128 ? v : null;
  }

  // Visitor ID: identifica o NAVEGADOR — nunca muda depois de criado.
  var visitorId = doLink('fs_vid') || safeGet('zf_visitor_id');
  if (!visitorId) {
    visitorId = uuid('v_');
  }
  safeSet('zf_visitor_id', visitorId);

  // Lead ID persistente: identifica a jornada de compra atual.
  // O do link tem prioridade sobre o armazenado — é a visita que está
  // acontecendo agora, e é ela que o servidor acabou de registrar.
  var leadId = doLink('lead_id') || safeGet('lead_id');
  if (!leadId) {
    leadId = uuid('l_');
  }
  safeSet('lead_id', leadId);

  // Session ID: renova após 30min de inatividade.
  var SESSION_TTL = 30 * 60 * 1000;
  var sessionId = doLink('fs_sid');
  try {
    var now = Date.now();
    if (!sessionId) {
      var rawSess = safeGet('zf_session');
      if (rawSess) {
        var sess = JSON.parse(rawSess);
        if (sess && sess.id && now - (sess.t || 0) < SESSION_TTL) sessionId = sess.id;
      }
    }
    if (!sessionId) sessionId = uuid('s_');
    safeSet('zf_session', JSON.stringify({ id: sessionId, t: now }));
  } catch (e) {
    if (!sessionId) sessionId = uuid('s_');
  }
  function touchSession() {
    try {
      safeSet('zf_session', JSON.stringify({ id: sessionId, t: Date.now() }));
    } catch (e) {}
  }

  function send(eventName, extra) {
    touchSession();
    var payload = {
      site: siteId,
      lead_id: leadId,
      visitor_id: visitorId,
      session_id: sessionId,
      event: eventName,
      url: window.location.href,
      referrer: document.referrer || safeGet('zf_first_referrer') || null,
      ts: Date.now(),
      utm: getUtms(),
      click_ids: getClickIds(),
      meta: extra || null,
    };
    var url = apiBase.replace(/\/$/, '') + '/api/track/event';
    log('send', eventName, payload);
    try {
      if (navigator.sendBeacon) {
        var blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
        var ok = navigator.sendBeacon(url, blob);
        if (ok) return;
      }
      fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        keepalive: true,
        mode: 'cors',
      }).catch(function () {});
    } catch (e) {}
  }

  // page_view automático
  send('page_view');

  // scroll profundo (1x por página, ao passar de 60%)
  var scrollSent = false;
  try {
    window.addEventListener(
      'scroll',
      function () {
        if (scrollSent) return;
        var h = document.documentElement;
        var scrolled = (window.pageYOffset + window.innerHeight) / (h.scrollHeight || 1);
        if (scrolled > 0.6) {
          scrollSent = true;
          send('scroll_60');
        }
      },
      { passive: true }
    );
  } catch (e) {}

  // API pública
  window.zfLeadId = leadId;
  window.zfVisitorId = visitorId;
  window.zfSessionId = sessionId;
  window.zfUtms = getUtms();
  window.zfClickIds = getClickIds();
  window.trackEvent = function (name, meta) {
    if (!name) return;
    send(String(name), meta || null);
  };
  window.zfTrackConversion = function (value, product, meta) {
    var url = apiBase.replace(/\/$/, '') + '/api/track/conversion';
    var m = meta || {};
    var body = JSON.stringify({
      site: siteId,
      lead_id: leadId,
      visitor_id: visitorId,
      session_id: sessionId,
      value: Number(value) || 0,
      product: product || null,
      order_id: m.order_id || m.orderId || null,
      platform: m.platform || null,
      currency: m.currency || 'BRL',
      meta: m,
    });
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
  };

  // Detecção de links de checkout / whatsapp
  var CHECKOUT_HOSTS = [
    'hotmart.com',
    'pay.hotmart',
    'kiwify.',
    'eduzz.com',
    'sun.eduzz',
    'monetizze.com',
    'monetizze.com.br',
    'perfectpay.com',
    'pagar.me',
    'mercadopago',
    'checkout.stripe',
    'buy.stripe',
  ];
  var WHATSAPP_HOSTS = ['wa.me', 'api.whatsapp.com', 'whatsapp.com/send', 'chat.whatsapp.com'];

  function isMatch(href, list) {
    var lower = (href || '').toLowerCase();
    for (var i = 0; i < list.length; i++) if (lower.indexOf(list[i]) >= 0) return true;
    return false;
  }

  // Parâmetro NATIVO de tracking de cada plataforma de checkout. O valor volta
  // no webhook da plataforma, permitindo atribuição determinística.
  //   Hotmart      → sck               (volta em purchase.origin.sck / sckPaymentLink)
  //   Kiwify       → s1                (volta em TrackingParameters.s1)
  //   Eduzz        → utm_content       (volta nos campos utm do webhook)
  //   Monetizze    → src               (volta em tracking/src)
  //   Perfect Pay  → src               (volta em tracking src)
  //   Stripe       → client_reference_id (volta em checkout.session)
  function nativeTrackingParam(href) {
    var h = (href || '').toLowerCase();
    if (h.indexOf('hotmart') >= 0) return 'sck';
    if (h.indexOf('kiwify') >= 0) return 's1';
    if (h.indexOf('eduzz') >= 0) return 'utm_content';
    if (h.indexOf('monetizze') >= 0) return 'src';
    if (h.indexOf('perfectpay') >= 0) return 'src';
    if (h.indexOf('stripe') >= 0) return 'client_reference_id';
    return null;
  }

  function tagAndBindLinks() {
    var links = document.querySelectorAll('a[href]');
    for (var i = 0; i < links.length; i++) {
      var a = links[i];
      if (a.__zfBound) continue;
      var href = a.getAttribute('href') || '';
      var checkout = isMatch(href, CHECKOUT_HOSTS) || a.hasAttribute('data-checkout');
      var whatsapp = isMatch(href, WHATSAPP_HOSTS) || a.hasAttribute('data-whatsapp');
      if (!checkout && !whatsapp) continue;

      // Injeta lead_id em links de checkout — no parâmetro genérico E no
      // parâmetro nativo da plataforma (para o webhook devolver o lead_id).
      if (checkout) {
        try {
          var u = new URL(href, window.location.href);
          if (!u.searchParams.has('lead_id')) {
            u.searchParams.set('lead_id', leadId);
          }
          var nativeParam = nativeTrackingParam(href);
          if (nativeParam && !u.searchParams.has(nativeParam)) {
            u.searchParams.set(nativeParam, leadId);
          }
          // Propaga UTMs para o checkout
          var utms = getUtms();
          Object.keys(utms).forEach(function (k) {
            if (!u.searchParams.has(k)) u.searchParams.set(k, utms[k]);
          });
          a.setAttribute('href', u.toString());
        } catch (e) {}
      }

      a.addEventListener(
        'click',
        (function (link, isCheckout) {
          return function () {
            send(isCheckout ? 'click_checkout' : 'click_whatsapp', { href: link.href });
          };
        })(a, checkout)
      );
      a.__zfBound = true;
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', tagAndBindLinks);
  } else {
    tagAndBindLinks();
  }
  try {
    var mo = new MutationObserver(function () {
      tagAndBindLinks();
    });
    if (document.body) mo.observe(document.body, { childList: true, subtree: true });
  } catch (e) {}

  log('iniciado', { siteId: siteId, leadId: leadId, visitorId: visitorId, sessionId: sessionId, apiBase: apiBase });
})();
