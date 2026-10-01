/*
 * Quiz ("fake form") + GHL bridge.
 * Runs the quiz, validates answers, then fills the hidden native GHL form on
 * the same page and clicks its submit button.
 * Which quiz answer goes into which GHL field is set in NBS_CONFIG below.
 * Debug: add ?nbsdebug=1 to the page URL. The GHL form stays visible and a panel
 * lists its fields, what each answer maps to, and what was written on submit.
 */
(function () {
  /* =========================================================
     CONFIG: edit to match your hidden GHL form.
     Each answer lists where it goes, tried in order; the first match wins:
       'label:Some text'  a GHL field whose question/label contains that text
       'some_name'        a GHL field with that name attribute
     ========================================================= */
  var NBS_CONFIG = {
    ghlFormSelector: '#form-v-k6neyDcf',   // the hidden GHL form (falls back to auto-detect if not found)
    fields: {
      services:  ['label:What are you looking to have installed'],
      size:      ['label:Roughly how big is your area'],
      timeframe: ['label:When would you like the work done'],
      budget:    ['label:What is your budget'],
      area:      ['label:Where are you based', 'city'],
      full_name: ['full_name', 'label:Full name'],
      phone:     ['phone', 'label:Phone'],
      email:     ['email', 'label:Email'],
      summary:   []                     // optional: a multi-line field that gets every answer, e.g. ['label:Quiz answers']
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
      if (step && step.dataset.validate === 'area' && !checkArea()) return;
      show(current + 1);
    }
  });

  /* ---------- Validation ---------- */
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
  // Any area name is fine (no postcode format to trip over); just not blank.
  function checkArea() {
    var el = document.getElementById('nbs-area');
    var v = el.value.trim().replace(/\s+/g, ' ');
    var ok = setError(el, v.length < 2);
    if (ok) { el.value = v; answers.area = v; }
    return ok;
  }
  document.getElementById('nbs-area').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { e.preventDefault(); if (checkArea()) show(current + 1); }
  });
  root.querySelectorAll('.nbs-input').forEach(function (el) {
    el.addEventListener('input', function () { if (el.classList.contains('is-invalid')) setError(el, false); });
  });

  /* ---------- GHL form bridge ---------- */
  function norm(s) { return String(s == null ? '' : s).toLowerCase().replace(/[^a-z0-9]/g, ''); }

  function findGhlForm() {
    var el = NBS_CONFIG.ghlFormSelector && document.querySelector(NBS_CONFIG.ghlFormSelector);
    if (el) return el.tagName === 'FORM' ? el : (el.querySelector('form') || el);
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

  function inputsOf(form) {
    return [].slice.call(form.querySelectorAll('input, select, textarea')).filter(function (el) { return el.type !== 'hidden'; });
  }

  function describeFields(form) {
    return inputsOf(form).map(function (el) {
      return { name: el.name, id: el.id, type: el.type, value: el.type === 'checkbox' ? el.checked : el.value, label: labelText(el) };
    });
  }

  // The visible question for a field. GHL puts the label next to the input, not around it,
  // so also look up a few parent levels for the field's own label.
  function labelText(el) {
    var clean = function (t) { return t.replace(/\s+/g, ' ').replace(/\*\s*$/, '').trim(); };
    var l = el.closest('label');
    if (!l && el.id) { try { l = document.querySelector('label[for="' + CSS.escape(el.id) + '"]'); } catch (e) {} }
    if (l) return clean(l.textContent);
    var node = el.parentElement;
    for (var i = 0; node && i < 4; i++, node = node.parentElement) {
      if (node.querySelectorAll('input:not([type="hidden"]), select, textarea').length > 1) break;
      var lab = node.querySelector('label, .label, [class*="label"]');
      if (lab && !lab.contains(el) && clean(lab.textContent)) return clean(lab.textContent);
    }
    return el.getAttribute('aria-label') || el.placeholder || '';
  }

  // 'label:Some text' → fields whose label contains it; otherwise match name / data-q / id.
  function findFields(form, target) {
    if (target.indexOf('label:') === 0) {
      var want = norm(target.slice(6));
      return inputsOf(form).filter(function (el) {
        return el.type !== 'checkbox' && el.type !== 'radio' && norm(labelText(el)).indexOf(want) > -1;
      });
    }
    var found = [].slice.call(form.querySelectorAll('[name="' + target + '"], [data-q="' + target + '"]'));
    if (!found.length) { try { found = [].slice.call(form.querySelectorAll('#' + CSS.escape(target))); } catch (e) {} }
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

  function writeField(els, name, value) {
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

  // One line per quiz step, labelled with the step's data-label.
  function summaryText(a) {
    return numbered.filter(function (s) { return s.dataset.label; }).map(function (s) {
      var v = a[s.dataset.key];
      return s.dataset.label + ': ' + (Array.isArray(v) ? v.join(', ') : (v || '-'));
    }).concat('Offer: 10% OFF (limited time)').join('\n');
  }

  // For each answer, the first configured target that exists in the GHL form.
  function resolveTargets(form) {
    var out = {};
    Object.keys(NBS_CONFIG.fields).forEach(function (key) {
      var targets = NBS_CONFIG.fields[key] || [];
      for (var i = 0; i < targets.length; i++) {
        var els = findFields(form, targets[i]);
        if (els.length) { out[key] = { target: targets[i], els: els }; return; }
      }
      out[key] = { target: targets.join(' / ') || '(not set)', els: [] };
    });
    return out;
  }

  function fillGhl(form, a) {
    var values = {};
    Object.keys(a).forEach(function (k) { values[k] = a[k]; });
    values.summary = summaryText(a);
    var map = resolveTargets(form);
    var report = [];
    Object.keys(map).forEach(function (key) {
      var v = values[key], m = map[key];
      if (v == null || v === '' || (Array.isArray(v) && !v.length)) return;
      if (!m.els.length) { report.push([key, m.target, 'NOT FOUND']); log('No GHL field for', key, '→', m.target); return; }
      writeField(m.els, m.target, v);
      report.push([key, m.target, Array.isArray(v) ? v.join(', ') : v]);
    });
    if (NBS_CONFIG.tickConsent) tickConsent(form);
    log('Filled GHL form:', describeFields(form));
    debugPanel(form, report);
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

  /* ---------- Debug panel (?nbsdebug=1) ---------- */
  function debugPanel(form, written) {
    if (!NBS_CONFIG.debug) return;
    var esc = function (t) { return String(t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
    var row = function (cells, bold) {
      return '<tr>' + cells.map(function (c) { return '<td style="padding:4px 6px;border-top:1px solid #333;vertical-align:top;' + (bold ? 'font-weight:700' : '') + '">' + esc(c) + '</td>'; }).join('') + '</tr>';
    };
    var html = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px"><b>NBS debug</b>' +
      '<button type="button" onclick="this.closest(\'#nbs-debug\').remove()" style="background:#333;color:#fff;border:0;border-radius:4px;padding:2px 8px;cursor:pointer">×</button></div>';
    if (!form) {
      html += '<p style="color:#ff8a80">No GHL form found (selector ' + esc(NBS_CONFIG.ghlFormSelector || 'auto') + ').</p>';
    } else {
      var map = resolveTargets(form);
      html += '<p style="margin:0 0 4px">Quiz answer → GHL field</p><table style="border-collapse:collapse;width:100%">' +
        Object.keys(map).map(function (k) {
          var m = map[k];
          return row([k, m.els.length ? '✓ ' + labelText(m.els[0]) : (NBS_CONFIG.fields[k] || []).length ? '✗ not found (' + m.target + ')' : '– not used']);
        }).join('') + '</table>';
      html += '<p style="margin:8px 0 4px">All fields in the GHL form</p><table style="border-collapse:collapse;width:100%">' +
        row(['label', 'name', 'type'], true) + describeFields(form).map(function (f) { return row([f.label, f.name, f.type]); }).join('') + '</table>';
      if (written) {
        html += '<p style="margin:8px 0 4px">Written on submit</p><table style="border-collapse:collapse;width:100%">' +
          written.map(function (w) { return row([w[0], w[2]]); }).join('') + '</table>';
      }
    }
    var box = document.getElementById('nbs-debug') || document.body.appendChild(document.createElement('div'));
    box.id = 'nbs-debug';
    box.style.cssText = 'position:fixed;right:10px;bottom:10px;z-index:2147483647;width:min(440px,94vw);max-height:70vh;overflow:auto;' +
      'background:#111;color:#eee;font:12px/1.4 system-ui,sans-serif;padding:10px;border:2px solid #F89E1B;border-radius:10px;box-shadow:0 8px 30px rgba(0,0,0,.5)';
    box.innerHTML = html;
  }

  /* ---------- Init ---------- */
  function initForm(tries) {
    var form = findGhlForm();
    if (form) {
      hideGhlForm(form);
      if (NBS_CONFIG.debug) { console.table(describeFields(form)); debugPanel(form); }
      return;
    }
    if (tries > 0) setTimeout(function () { initForm(tries - 1); }, 500);
    else if (NBS_CONFIG.debug) { console.warn('[NBS] No GHL form found on the page.'); debugPanel(null); }
  }
  initForm(20);
  show(1);
})();
