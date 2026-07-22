/* FlowFunnel — tracker público de landing pages
 * Uso:
 *   <script src="https://SEU-SAAS.com/tracker.js" data-site="SEU_SITE_ID"></script>
 *
 * Captura UTMs, gera lead_id persistente, dispara page_view automático,
 * marca cliques em links de WhatsApp / checkout e injeta lead_id na URL
 * de checkout. Não interfere em nenhum tracker existente.
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

  function uuid() {
    return (
      'l_' +
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

  // Captura UTMs da URL atual e persiste
  var UTM_KEYS = ['utm_source', 'utm_campaign', 'utm_medium', 'utm_content', 'utm_term'];
  try {
    var qs = new URLSearchParams(window.location.search);
    UTM_KEYS.forEach(function (k) {
      var v = qs.get(k);
      if (v) safeSet(k, v);
    });
  } catch (e) {}

  function getUtms() {
    var out = {};
    UTM_KEYS.forEach(function (k) {
      var v = safeGet(k);
      if (v) out[k] = v;
    });
    return out;
  }

  // Lead ID persistente
  var leadId = safeGet('lead_id');
  if (!leadId) {
    leadId = uuid();
    safeSet('lead_id', leadId);
  }

  function send(eventName, extra) {
    var payload = {
      site: siteId,
      lead_id: leadId,
      event: eventName,
      url: window.location.href,
      referrer: document.referrer || null,
      ts: Date.now(),
      utm: getUtms(),
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

  // API pública
  window.zfLeadId = leadId;
  window.zfUtms = getUtms();
  window.trackEvent = function (name, meta) {
    if (!name) return;
    send(String(name), meta || null);
  };
  window.zfTrackConversion = function (value, product, meta) {
    var url = apiBase.replace(/\/$/, '') + '/api/track/conversion';
    var body = JSON.stringify({
      site: siteId,
      lead_id: leadId,
      value: Number(value) || 0,
      product: product || null,
      meta: meta || null,
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

  function tagAndBindLinks() {
    var links = document.querySelectorAll('a[href]');
    for (var i = 0; i < links.length; i++) {
      var a = links[i];
      if (a.__zfBound) continue;
      var href = a.getAttribute('href') || '';
      var checkout = isMatch(href, CHECKOUT_HOSTS) || a.hasAttribute('data-checkout');
      var whatsapp = isMatch(href, WHATSAPP_HOSTS) || a.hasAttribute('data-whatsapp');
      if (!checkout && !whatsapp) continue;

      // Injeta lead_id em links de checkout
      if (checkout) {
        try {
          var u = new URL(href, window.location.href);
          if (!u.searchParams.has('lead_id')) {
            u.searchParams.set('lead_id', leadId);
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

  log('iniciado', { siteId: siteId, leadId: leadId, apiBase: apiBase });
})();
