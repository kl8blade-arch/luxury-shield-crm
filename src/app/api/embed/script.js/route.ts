import { NextRequest, NextResponse } from 'next/server'

/**
 * GET /api/embed/script.js — Embeddable tracking + form script
 *
 * Usage on any landing page:
 * <script src="https://luxury-shield-crm.vercel.app/api/embed/script.js?key=YOUR_API_KEY"></script>
 *
 * Automatically:
 * 1. Captures UTM params from URL (?utm_source=facebook&utm_medium=paid&utm_campaign=dental_fl)
 * 2. Detects referrer (organic google, facebook, instagram, tiktok, direct, etc.)
 * 3. Intercepts any form submission on the page and sends to CRM
 * 4. OR provides window.LuxuryShield.sendLead({ name, phone, email }) function
 */
export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get('key') || ''
  const endpoint = process.env.NEXT_PUBLIC_APP_URL || 'https://luxury-shield-crm.vercel.app'

  const script = `
(function() {
  "use strict";

  var API = "${endpoint}/api/save-lead";
  var WEBHOOK = "${endpoint}/api/v1/webhooks/inbound";
  var KEY = "${key}";

  // ── Parse UTM params from URL ──
  function getParams() {
    var p = new URLSearchParams(window.location.search);
    return {
      utm_source: p.get("utm_source") || detectSource(),
      utm_medium: p.get("utm_medium") || detectMedium(),
      utm_campaign: p.get("utm_campaign") || p.get("campaign") || "",
      utm_content: p.get("utm_content") || "",
      utm_term: p.get("utm_term") || "",
      url_origin: window.location.href,
      referrer: document.referrer || ""
    };
  }

  // ── Auto-detect traffic source from referrer ──
  function detectSource() {
    var r = (document.referrer || "").toLowerCase();
    if (!r) return "direct";
    if (r.includes("facebook.com") || r.includes("fb.com") || r.includes("fbclid")) return "facebook";
    if (r.includes("instagram.com")) return "instagram";
    if (r.includes("tiktok.com")) return "tiktok";
    if (r.includes("twitter.com") || r.includes("x.com") || r.includes("t.co")) return "twitter";
    if (r.includes("linkedin.com")) return "linkedin";
    if (r.includes("youtube.com") || r.includes("youtu.be")) return "youtube";
    if (r.includes("google.com") || r.includes("google.co")) return "google";
    if (r.includes("bing.com")) return "bing";
    if (r.includes("yahoo.com")) return "yahoo";
    return "referral";
  }

  // ── Detect paid vs organic ──
  function detectMedium() {
    var p = new URLSearchParams(window.location.search);
    if (p.get("utm_medium")) return p.get("utm_medium");
    if (p.get("gclid") || p.get("gbraid") || p.get("wbraid")) return "cpc";
    if (p.get("fbclid")) return "paid_social";
    if (p.get("ttclid")) return "paid_social";
    if (p.get("li_fat_id")) return "paid_social";
    var r = (document.referrer || "").toLowerCase();
    if (!r) return "direct";
    if (r.includes("google") || r.includes("bing") || r.includes("yahoo")) return "organic";
    if (r.includes("facebook") || r.includes("instagram") || r.includes("tiktok") || r.includes("twitter") || r.includes("linkedin")) return "social";
    return "referral";
  }

  // ── Send lead to CRM ──
  function sendLead(data) {
    var params = getParams();
    var payload = Object.assign({}, data, {
      utm_source: data.utm_source || params.utm_source,
      utm_campaign: data.utm_campaign || params.utm_campaign,
      url_origin: params.url_origin,
      fuente: params.utm_source + (params.utm_medium ? "_" + params.utm_medium : ""),
      source: params.utm_source,
      medium: params.utm_medium,
      referrer: params.referrer
    });

    // Use webhook if API key available, else save-lead
    var url = KEY ? WEBHOOK : API;
    var headers = { "Content-Type": "application/json" };
    if (KEY) headers["x-api-key"] = KEY;

    return fetch(url, {
      method: "POST",
      headers: headers,
      body: JSON.stringify(payload)
    }).then(function(r) { return r.json(); });
  }

  // ── Auto-intercept forms ──
  function interceptForms() {
    document.addEventListener("submit", function(e) {
      var form = e.target;
      if (!form || form.tagName !== "FORM") return;
      if (form.dataset.lsIgnore === "true") return;

      // Check if form has phone or email field
      var data = new FormData(form);
      var obj = {};
      data.forEach(function(v, k) { obj[k.toLowerCase().replace(/[^a-z_]/g, "")] = v; });

      var name = obj.name || obj.nombre || obj.full_name || obj.nombre_completo || "";
      var phone = obj.phone || obj.telefono || obj.phone_number || obj.celular || obj.whatsapp || "";
      var email = obj.email || obj.correo || obj.mail || "";

      if (!name && !phone && !email) return; // Not a lead form

      e.preventDefault();
      sendLead({
        name: name,
        phone: phone,
        email: email,
        state: obj.state || obj.estado || "",
        insurance_type: obj.product || obj.producto || obj.insurance_type || obj.servicio || ""
      }).then(function(res) {
        // Success callback
        if (window.LuxuryShield && window.LuxuryShield.onSuccess) {
          window.LuxuryShield.onSuccess(res);
        }
        // Try to follow original form action
        if (form.dataset.lsRedirect) {
          window.location.href = form.dataset.lsRedirect;
        } else if (form.dataset.lsThankYou) {
          form.innerHTML = '<div style="padding:20px;text-align:center;font-size:18px;">' + form.dataset.lsThankYou + '</div>';
        } else {
          form.innerHTML = '<div style="padding:20px;text-align:center;font-size:18px;color:#22c55e;">Gracias! Te contactaremos pronto.</div>';
        }
      }).catch(function() {
        if (form.action && form.action !== window.location.href) form.submit();
      });
    }, true);
  }

  // ── Track page view ──
  function trackVisit() {
    var params = getParams();
    if (typeof navigator.sendBeacon === "function") {
      navigator.sendBeacon("${endpoint}/api/track", JSON.stringify({
        type: "pageview",
        url: params.url_origin,
        source: params.utm_source,
        medium: params.utm_medium,
        campaign: params.utm_campaign,
        referrer: params.referrer
      }));
    }
  }

  // ── Initialize ──
  interceptForms();
  trackVisit();

  // ── Public API ──
  window.LuxuryShield = {
    sendLead: sendLead,
    getParams: getParams,
    onSuccess: null
  };
})();
`

  return new NextResponse(script, {
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
      'Access-Control-Allow-Origin': '*',
    },
  })
}
