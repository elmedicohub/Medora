
(() => {
  'use strict';

  /*
   * ACL / Medora Interests — specialty-neutral filter
   * Removes interest cards/topics that are a named medical specialty,
   * subspecialty, organ-system specialty, procedural specialty, or
   * specialty-specific imaging field.
   *
   * It intentionally keeps broad cross-cutting interests such as:
   * research, education, teaching, leadership, AI, technology,
   * entrepreneurship, public health, communication, wellness,
   * fitness, travel, languages, productivity, mentoring, etc.
   */

  const SPECIALTY_TERMS = [
    // Cardiology / cardiovascular subspecialties
    'cardiology',
    'cardiac imaging',
    'cardiovascular imaging',
    'echocardiography',
    'interventional cardiology',
    'electrophysiology',
    'heart failure',
    'preventive cardiology',
    'structural heart',
    'adult congenital heart',
    'congenital heart disease',
    'cardiac rehabilitation',
    'cardio-oncology',
    'cardio oncology',
    'vascular medicine',
    'vascular surgery',

    // Internal medicine specialties/subspecialties
    'internal medicine',
    'endocrinology',
    'diabetes',
    'gastroenterology',
    'hepatology',
    'nephrology',
    'renal medicine',
    'pulmonology',
    'respiratory medicine',
    'rheumatology',
    'hematology',
    'haematology',
    'oncology',
    'medical oncology',
    'infectious diseases',
    'infectious disease',
    'geriatrics',
    'geriatric medicine',
    'allergy and immunology',
    'immunology',

    // Surgical specialties
    'surgery',
    'general surgery',
    'cardiac surgery',
    'cardiothoracic surgery',
    'thoracic surgery',
    'neurosurgery',
    'orthopedic surgery',
    'orthopaedic surgery',
    'plastic surgery',
    'urology',
    'otolaryngology',
    'ent',
    'ophthalmology',
    'oral and maxillofacial surgery',

    // Other clinical specialties
    'neurology',
    'psychiatry',
    'dermatology',
    'radiology',
    'diagnostic radiology',
    'interventional radiology',
    'nuclear medicine',
    'anesthesiology',
    'anaesthesiology',
    'emergency medicine',
    'critical care',
    'intensive care medicine',
    'family medicine',
    'general practice',
    'pediatrics',
    'paediatrics',
    'obstetrics',
    'gynecology',
    'gynaecology',
    'obstetrics and gynecology',
    'obstetrics and gynaecology',
    'reproductive medicine',
    'pathology',
    'clinical pathology',
    'laboratory medicine',
    'rehabilitation medicine',
    'physical medicine and rehabilitation',
    'sports medicine',
    'occupational medicine',
    'palliative medicine',
    'pain medicine',
    'dentistry',
    'pharmacy',
    'clinical pharmacy',

    // Explicit specialty-like phrases often used as interest cards
    'coronary intervention',
    'coronary interventions',
    'pci',
    'tavi',
    'transcatheter valve',
    'mitral intervention',
    'tricuspid intervention',
    'ct imaging',
    'mri imaging',
    'cmr',
    'cardiac ct'
  ];

  const NORMALIZED_TERMS = SPECIALTY_TERMS
    .map(x => x.toLowerCase().replace(/\s+/g, ' ').trim())
    .sort((a, b) => b.length - a.length);

  const normalize = (value = '') =>
    String(value)
      .toLowerCase()
      .replace(/&/g, ' and ')
      .replace(/[–—]/g, '-')
      .replace(/[^\p{L}\p{N}+\- ]/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  function containsSpecialty(text) {
    const t = normalize(text);
    if (!t) return false;

    return NORMALIZED_TERMS.some(term => {
      const n = normalize(term);
      if (!n) return false;

      // Exact / phrase match.
      if (t === n || t.includes(n)) return true;

      // Handle simple punctuation/wording variants.
      const compactT = t.replace(/-/g, ' ');
      const compactN = n.replace(/-/g, ' ');
      return compactT.includes(compactN);
    });
  }

  function getCardTitle(card) {
    const selectors = [
      'h1','h2','h3','h4',
      '.interest-title',
      '.card-title',
      '[data-interest-title]',
      '[data-title]',
      '.title'
    ];

    for (const selector of selectors) {
      const el = card.querySelector?.(selector);
      const text = el?.textContent?.trim();
      if (text) return text;
    }
    return '';
  }

  function isInterestCard(el) {
    if (!(el instanceof Element)) return false;

    return el.matches(
      [
        '[data-interest-id]',
        '[data-interest]',
        '.interest-card',
        '.interests-card',
        '.interest-item',
        '.interest-tile',
        '.interest-option',
        '.community-interest-card',
        '.discover-interest-card'
      ].join(',')
    );
  }

  function candidateCards(root = document) {
    const selector = [
      '[data-interest-id]',
      '[data-interest]',
      '.interest-card',
      '.interests-card',
      '.interest-item',
      '.interest-tile',
      '.interest-option',
      '.community-interest-card',
      '.discover-interest-card'
    ].join(',');

    const explicit = [...root.querySelectorAll(selector)];

    if (explicit.length) return explicit;

    // Fallback for pages using generic .card classes.
    return [...root.querySelectorAll('article, .card, [class*="card"]')].filter(el => {
      const text = getCardTitle(el) || el.textContent || '';
      return (
        /add to mine|people|professional|interest/i.test(el.textContent || '') &&
        text.trim().length > 0
      );
    });
  }

  function removeSpecialtyCards(root = document) {
    let removed = 0;

    candidateCards(root).forEach(card => {
      const title = getCardTitle(card);
      const combined = `${title} ${card.textContent || ''}`;

      // Prefer title matching. Combined-text matching is fallback only.
      if (containsSpecialty(title) || (!title && containsSpecialty(combined))) {
        card.remove();
        removed++;
      }
    });

    // Remove specialty chips/tags from any remaining cards.
    root.querySelectorAll(
      '.interest-chip, .interest-tag, .tag, .chip, [data-interest-tag]'
    ).forEach(tag => {
      if (containsSpecialty(tag.textContent || '')) tag.remove();
    });

    document.documentElement.dataset.specialtyNeutralInterests = 'true';
    return removed;
  }

  function cleanInterestSelects(root = document) {
    root.querySelectorAll('select').forEach(select => {
      const name = normalize(
        [
          select.name,
          select.id,
          select.getAttribute('aria-label'),
          select.closest('label')?.textContent
        ].filter(Boolean).join(' ')
      );

      if (!/interest/.test(name)) return;

      [...select.options].forEach(option => {
        if (containsSpecialty(option.textContent || option.value || '')) {
          option.remove();
        }
      });
    });
  }

  function cleanCheckboxes(root = document) {
    root.querySelectorAll('label').forEach(label => {
      const input = label.querySelector('input[type="checkbox"],input[type="radio"]');
      if (!input) return;

      const context = normalize(
        [
          input.name,
          input.id,
          label.textContent
        ].filter(Boolean).join(' ')
      );

      if (/interest/.test(context) && containsSpecialty(label.textContent || '')) {
        const wrapper =
          label.closest('.interest-option,.form-check,.checkbox-row,.radio-row') || label;
        wrapper.remove();
      }
    });
  }

  function run(root = document) {
    removeSpecialtyCards(root);
    cleanInterestSelects(root);
    cleanCheckboxes(root);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => run(document), { once: true });
  } else {
    run(document);
  }

  // Handles Supabase/JS rendered cards after initial load.
  let timer = null;
  const observer = new MutationObserver(mutations => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (!(node instanceof Element)) continue;
          if (isInterestCard(node) || node.querySelector?.('[data-interest-id],.interest-card,.interest-item,.interest-tile')) {
            run(node.parentElement || document);
          }
        }
      }
    }, 40);
  });

  observer.observe(document.documentElement, { childList: true, subtree: true });

  // Public hook if another script re-renders the Interests list.
  window.ACLInterests = Object.freeze({
    refresh: () => run(document),
    isSpecialty: containsSpecialty
  });
})();
