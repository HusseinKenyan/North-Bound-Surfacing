/*
 * Quiz ("fake form") + GHL bridge.
 * Runs the 5-step quiz, validates answers, then fills the hidden native GHL
 * form on the same page and clicks its submit button.
 * Configure the GHL field names in NBS_CONFIG below.
 * Debug: add ?nbsdebug=1 to the page URL to reveal the GHL form and list its fields.
 */
(function () {
  /* =========================================================
     CONFIG — edit to match your hidden GHL form.
     Each answer can be written to one or more GHL fields.
     Use the field's "name" (run the page with ?nbsdebug=1 to list them).
     Leave an array empty to skip that answer.
     ========================================================= */
  var NBS_CONFIG = {
    ghlFormSelector: '',            // leave '' to auto-detect the GHL form on the page
    fields: {
      full_name:  ['full_name'],
      first_name: ['first_name'],
      last_name:  ['last_name'],
      phone:      ['phone'],
      email:      ['email'],
      postcode:   ['postal_code'],
      services:   [],               // e.g. ['surface_type']  (checkbox, multi-select, dropdown or text field)
      size:       [],               // e.g. ['driveway_size']
      timeframe:  [],               // e.g. ['project_timeframe']
      summary:    []                // e.g. ['quiz_answers'] (a multi-line text field that receives every answer)
    },
    tickConsent: true,              // tick GHL's consent/terms checkbox (our form shows the consent wording)
    phoneFormat: 'e164',            // 'e164' turns 07123 456789 into +447123456789; 'raw' sends as typed
    successTimeoutMs: 7000,         // if GHL hasn't redirected by then, show our thank-you message
    redirectUrl: '',                // optional: send people here after that timeout instead (e.g. your thank-you page)
    fireFacebookLead: false,        // true = fbq('track','Lead') on submit. Leave false if your thank-you page fires it.
    debug: /[?&]nbsdebug=1/.test(location.search)
  };
  // Optional: define window.NBS_CONFIG_OVERRIDE = { fields: {...} } in an earlier script to override the above.
  if (window.NBS_CONFIG_OVERRIDE) {
    var o = window.NBS_CONFIG_OVERRIDE;
    Object.keys(o).forEach(function (k) { if (k !== 'fields') NBS_CONFIG[k] = o[k]; });
    if (o.fields) Object.keys(o.fields).forEach(function (k) { NBS_CONFIG.fields[k] = o.fields[k]; });
  }

  var root = document.getElementById('nbs-quiz-card');
  if (!root) return;
  var steps = [].slice.call(root.querySelectorAll('.nbs-step'));
  var numbered = steps.filter(function (s) { return /^\d+$/.test(s.dataset.step); });
  var total = numbered.length;
  var answers = { services: [] };
  var current = 1;

  function log() { if (NBS_CONFIG.debug) console.log.apply(console, ['[NBS]'].concat([].slice.call(arguments))); }

  /* ---------- Step navigation ---------- */
  function show(step) {
    steps.forEach(function (s) { s.classList.toggle('is-active', String(s.dataset.step) === String(step)); });
    current = step;
    var n = step === 'done' ? total : step - 1;
    document.getElementById('nbs-progress-fill').style.width = Math.round((n / total) * 100) + '%';
    document.getElementById('nbs-progress-label').textContent = step === 'done' ? 'Complete' : 'Step ' + step + ' of ' + total;
    var active = root.querySelector('.nbs-step.is-active');
    var input = active && active.querySelector('input');
    if (input && window.matchMedia('(min-width: 760px)').matches) setTimeout(function () { input.focus(); }, 60);
    var quiz = document.getElementById('nbs-quiz');
    var top = quiz.getBoundingClientRect().top;
    if (top < -40) window.scrollTo({ top: window.pageYOffset + top, behavior: 'smooth' });
  }

  root.addEventListener('click', function (e) {
    var tile = e.target.closest('.nbs-tile');
    var step = e.target.closest('.nbs-step');
    if (tile && step) {
      var key = step.dataset.key;
      if (step.hasAttribute('data-multi')) {
        tile.classList.toggle('is-selected');
        answers[key] = [].slice.call(step.querySelectorAll('.nbs-tile.is-selected')).map(function (t) { return t.dataset.value; });
        step.querySelector('[data-next]').disabled = answers[key].length === 0;
      } else {
        step.querySelectorAll('.nbs-tile').forEach(function (t) { t.classList.remove('is-selected'); });
        tile.classList.add('is-selected');
        answers[key] = tile.dataset.value;
        setTimeout(function () { show(current + 1); }, 220);
      }
      return;
    }
    if (e.target.closest('[data-back]')) { show(Math.max(1, current - 1)); return; }
    if (e.target.closest('[data-next]')) {
      if (current === 4 && !checkPostcode()) return;
      show(current + 1);
    }
  });

  /* ---------- Validation ---------- */
  var RE_POSTCODE = /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i;
  var RE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  function setError(input, bad) {
    input.classList.toggle('is-invalid', bad);
    input.closest('.nbs-field').classList.toggle('has-error', bad);
    return !bad;
  }
  function cleanPhone(v) { return v.replace(/[\s\-().]/g, ''); }
  function validPhone(v) { return /^(?:\+44|0044|0)(?:7\d{9}|[1-3]\d{8,9}|8\d{8,9})$/.test(cleanPhone(v)); }
  function formatPhone(v) {
    v = cleanPhone(v);
    if (NBS_CONFIG.phoneFormat !== 'e164') return v;
    if (v.indexOf('0044') === 0) return '+44' + v.slice(4);
    if (v.charAt(0) === '0') return '+44' + v.slice(1);
    return v;
  }
  function formatPostcode(v) {
    v = v.replace(/\s+/g, '').toUpperCase();
    return v.length > 3 ? v.slice(0, -3) + ' ' + v.slice(-3) : v;
  }
  function checkPostcode() {
    var el = document.getElementById('nbs-postcode');
    var ok = setError(el, !RE_POSTCODE.test(el.value.trim()));
    if (ok) { el.value = formatPostcode(el.value); answers.postcode = el.value; }
    return ok;
  }
  document.getElementById('nbs-postcode').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { e.preventDefault(); if (checkPostcode()) show(5); }
  });
  root.querySelectorAll('.nbs-input').forEach(function (el) {
    el.addEventListener('input', function () { if (el.classList.contains('is-invalid')) setError(el, false); });
  });

  /* ---------- GHL form bridge ---------- */
  function norm(s) { return String(s == null ? '' : s).toLowerCase().replace(/[^a-z0-9]/g, ''); }

  function findGhlForm() {
    if (NBS_CONFIG.ghlFormSelector) {
      var el = document.querySelector(NBS_CONFIG.ghlFormSelector);
      return el && el.tagName !== 'FORM' ? (el.querySelector('form') || el) : el;
    }
    var forms = document.querySelectorAll('form');
    for (var i = 0; i < forms.length; i++) {
      var f = forms[i];
      if (f.id === 'nbs-contact' || f.closest('#nbs-quiz')) continue;
      if (f.querySelector('input[name="email"], input[name="phone"], input[type="email"], input[type="tel"]')) return f;
    }
    return null;
  }

  function hideGhlForm(form) {
    if (!form || NBS_CONFIG.debug || form.dataset.nbsHidden) return;
    form.dataset.nbsHidden = '1';
    // Moved off-screen (not display:none) so GHL still validates and submits it normally.
    form.setAttribute('aria-hidden', 'true');
    form.style.cssText += ';position:absolute!important;left:-10000px!important;top:0!important;width:320px!important;opacity:0!important;pointer-events:none!important;';
  }

  function describeFields(form) {
    var rows = [];
    form.querySelectorAll('input, select, textarea').forEach(function (el) {
      if (el.type === 'hidden') return;
      rows.push({ name: el.name, 'data-q': el.getAttribute('data-q'), id: el.id, type: el.type, value: el.value, label: labelText(el) });
    });
    return rows;
  }

  function labelText(el) {
    var l = el.closest('label') || (el.id && document.querySelector('label[for="' + el.id + '"]'));
    return l ? l.textContent.trim() : (el.getAttribute('aria-label') || el.placeholder || '');
  }

  function fieldsByName(form, name) {
    var sel = '[name="' + name + '"], [data-q="' + name + '"]';
    var found = [].slice.call(form.querySelectorAll(sel));
    if (!found.length) { try { found = [].slice.call(form.querySelectorAll('#' + CSS.escape(name))); } catch (e) {} }
    return found;
  }

  function fire(el, types) {
    types.forEach(function (t) { el.dispatchEvent(new Event(t, { bubbles: true })); });
  }

  function setNativeValue(el, value) {
    var proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype
      : el.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
    var desc = Object.getOwnPropertyDescriptor(proto, 'value');
    if (desc && desc.set) desc.set.call(el, value); else el.value = value;
    fire(el, ['input', 'keyup', 'change', 'blur']);
  }

  function matches(el, wanted) {
    var targets = wanted.map(norm);
    return targets.indexOf(norm(el.value)) > -1 || targets.indexOf(norm(labelText(el))) > -1;
  }

  function writeField(form, name, value) {
    var els = fieldsByName(form, name);
    if (!els.length) { log('Field not found in GHL form:', name); return false; }
    var list = Array.isArray(value) ? value : [value];
    var text = list.join(', ');
    var first = els[0];

    if (first.type === 'checkbox' || first.type === 'radio') {
      var hit = false;
      els.forEach(function (el) {
        var want = matches(el, list);
        if (want !== el.checked) { el.click(); if (el.checked !== want) { el.checked = want; fire(el, ['change']); } }
        hit = hit || want;
      });
      if (!hit) log('No option matched for', name, list, '→ options:', els.map(function (e) { return e.value; }));
      return hit;
    }
    if (first.tagName === 'SELECT') {
      var opts = [].slice.call(first.options);
      if (first.multiple) {
        opts.forEach(function (o) { o.selected = list.map(norm).indexOf(norm(o.value)) > -1 || list.map(norm).indexOf(norm(o.text)) > -1; });
        fire(first, ['input', 'change']);
        return true;
      }
      var opt = opts.filter(function (o) { return norm(o.value) === norm(list[0]) || norm(o.text) === norm(list[0]); })[0]
        || opts.filter(function (o) { return norm(o.text).indexOf(norm(list[0])) > -1 && norm(list[0]); })[0];
      if (!opt) { log('No dropdown option matched for', name, list[0]); return false; }
      setNativeValue(first, opt.value);
      return true;
    }
    els.forEach(function (el) { setNativeValue(el, text); });
    return true;
  }

  function tickConsent(form) {
    form.querySelectorAll('input[type="checkbox"]').forEach(function (el) {
      if (el.checked) return;
      var t = norm(labelText(el) + ' ' + el.name);
      if (/terms|consent|agree|privacy|gdpr|marketing|contact/.test(t)) { el.click(); if (!el.checked) { el.checked = true; fire(el, ['change']); } }
    });
  }

  function summaryText(a) {
    return [
      'Services: ' + a.services.join(', '),
      'Area size: ' + (a.size || '-'),
      'Timeframe: ' + (a.timeframe || '-'),
      'Postcode: ' + (a.postcode || '-'),
      'Offer: 10% OFF (limited time)'
    ].join('\n');
  }

  function fillGhl(form, a) {
    var map = NBS_CONFIG.fields;
    var values = {
      full_name: a.full_name, first_name: a.first_name, last_name: a.last_name,
      phone: a.phone, email: a.email, postcode: a.postcode,
      services: a.services, size: a.size, timeframe: a.timeframe, summary: summaryText(a)
    };
    Object.keys(map).forEach(function (key) {
      (map[key] || []).forEach(function (name) {
        if (values[key] == null || values[key] === '') return;
        writeField(form, name, values[key]);
      });
    });
    if (NBS_CONFIG.tickConsent) tickConsent(form);
    log('Filled GHL form:', describeFields(form));
  }

  function submitGhl(form) {
    var btn = form.querySelector('button[type="submit"], input[type="submit"]') || form.querySelector('button');
    if (btn) { btn.disabled = false; btn.click(); }
    else if (form.requestSubmit) form.requestSubmit();
    else form.submit();
  }

  function ghlErrors(form) {
    var errs = [].slice.call(form.querySelectorAll('.error, .field-error, .error-message, .invalid-feedback, [class*="error"]'))
      .filter(function (e) { return e.textContent.trim() && e.offsetParent !== null; })
      .map(function (e) { return e.textContent.trim(); });
    return errs;
  }

  /* ---------- Submit ---------- */
  var sending = false;
  var submitBtn = document.getElementById('nbs-submit');
  var submitLabel = submitBtn.innerHTML;

  document.getElementById('nbs-contact').addEventListener('submit', function (e) {
    e.preventDefault();
    if (sending) return;
    var nameEl = document.getElementById('nbs-name');
    var phoneEl = document.getElementById('nbs-phone');
    var emailEl = document.getElementById('nbs-email');
    var ok = [
      setError(nameEl, nameEl.value.trim().length < 2),
      setError(phoneEl, !validPhone(phoneEl.value)),
      setError(emailEl, !RE_EMAIL.test(emailEl.value.trim()))
    ].every(Boolean);
    if (!ok) { var bad = root.querySelector('.is-invalid'); if (bad) bad.focus(); return; }

    var parts = nameEl.value.trim().replace(/\s+/g, ' ').split(' ');
    answers.full_name = parts.join(' ');
    answers.first_name = parts[0];
    answers.last_name = parts.slice(1).join(' ');
    answers.phone = formatPhone(phoneEl.value);
    answers.email = emailEl.value.trim();
    log('Answers:', answers);

    var form = findGhlForm();
    if (!form) {
      console.error('[NBS] No GHL form found on this page. Add the native Form element to the page (not an iframe embed) or set NBS_CONFIG.ghlFormSelector.');
      alert('Sorry, something went wrong sending your details. Please try again in a moment.');
      return;
    }

    sending = true;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="nbs-spinner"></span> Sending…';

    fillGhl(form, answers);
    if (NBS_CONFIG.fireFacebookLead && typeof window.fbq === 'function') window.fbq('track', 'Lead');
    try { window.dispatchEvent(new CustomEvent('nbs:lead', { detail: answers })); } catch (err) {}

    // Give GHL's form a tick to register the new values before submitting.
    setTimeout(function () {
      submitGhl(form);
      setTimeout(function () {
        var errs = ghlErrors(form);
        if (errs.length) {
          // GHL rejected something (usually a required field that isn't mapped). Let them retry.
          console.warn('[NBS] GHL form reported errors:', errs);
          if (NBS_CONFIG.debug) alert('GHL validation errors:\n' + errs.join('\n'));
          sending = false;
          submitBtn.disabled = false;
          submitBtn.innerHTML = submitLabel;
          alert('Sorry, we couldn\'t send your details. Please check them and try again.');
          return;
        }
        // Still on the page: GHL either showed its inline thank-you or needs a redirect.
        if (NBS_CONFIG.redirectUrl) { window.location.href = NBS_CONFIG.redirectUrl; return; }
        show('done');
        document.getElementById('nbs-reassure').style.display = 'none';
      }, NBS_CONFIG.successTimeoutMs);
    }, 150);
  });

  /* ---------- Init ---------- */
  function initForm(tries) {
    var form = findGhlForm();
    if (form) {
      hideGhlForm(form);
      if (NBS_CONFIG.debug) {
        console.log('[NBS] GHL form found. Its fields (use "name" in NBS_CONFIG.fields):');
        console.table(describeFields(form));
      }
      return;
    }
    if (tries > 0) setTimeout(function () { initForm(tries - 1); }, 500);
    else if (NBS_CONFIG.debug) console.warn('[NBS] No GHL form found on the page.');
  }
  initForm(20);
  show(1);
})();
