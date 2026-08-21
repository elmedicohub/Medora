(() => {
  "use strict";

  if (window.__MEDORA_DATE_FORMAT_PATCH__) return;
  window.__MEDORA_DATE_FORMAT_PATCH__ = true;

  const MONTHS = {
    jan: 1, january: 1,
    feb: 2, february: 2,
    mar: 3, march: 3,
    apr: 4, april: 4,
    may: 5,
    jun: 6, june: 6,
    jul: 7, july: 7,
    aug: 8, august: 8,
    sep: 9, sept: 9, september: 9,
    oct: 10, october: 10,
    nov: 11, november: 11,
    dec: 12, december: 12
  };

  const MONTH_PATTERN = "January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec";
  const currentYear = new Date().getFullYear();

  const pad = (value) => String(value).padStart(2, "0");

  function validDate(day, month, year) {
    const d = new Date(year, month - 1, day);
    return d.getFullYear() === year && d.getMonth() === month - 1 && d.getDate() === day;
  }

  function formatParts(day, month, year) {
    const d = Number(day);
    const m = Number(month);
    const y = Number(year);
    if (!validDate(d, m, y)) return null;
    return `${pad(d)}/${pad(m)}/${y}`;
  }

  function formatDateValue(value) {
    if (!value) return "";

    if (value instanceof Date && !Number.isNaN(value.getTime())) {
      return formatParts(value.getDate(), value.getMonth() + 1, value.getFullYear()) || "";
    }

    const raw = String(value).trim();
    let match = raw.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s].*)?$/);
    if (match) return formatParts(match[3], match[2], match[1]) || raw;

    const date = new Date(raw);
    if (!Number.isNaN(date.getTime())) {
      return formatParts(date.getDate(), date.getMonth() + 1, date.getFullYear()) || raw;
    }

    return raw;
  }

  window.medoraFormatDate = formatDateValue;

  function transformText(text) {
    let output = String(text);

    // ISO / database-style dates: 2026-09-17 -> 17/09/2026.
    output = output.replace(/\b(19\d{2}|20\d{2}|21\d{2})-(\d{2})-(\d{2})\b/g, (full, year, month, day) => {
      return formatParts(day, month, year) || full;
    });

    // English month first: Aug 21, 2026 -> 21/08/2026.
    const monthFirst = new RegExp(`\\b(${MONTH_PATTERN})\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,?\\s+(\\d{4}))?\\b`, "gi");
    output = output.replace(monthFirst, (full, monthName, day, year) => {
      const month = MONTHS[String(monthName).toLowerCase()];
      return formatParts(day, month, year || currentYear) || full;
    });

    // English day first: 21 Aug 2026 -> 21/08/2026.
    const dayFirst = new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(${MONTH_PATTERN})(?:\\s+(\\d{4}))?\\b`, "gi");
    output = output.replace(dayFirst, (full, day, monthName, year) => {
      const month = MONTHS[String(monthName).toLowerCase()];
      return formatParts(day, month, year || currentYear) || full;
    });

    return output;
  }

  function shouldSkip(node) {
    const parent = node.parentElement;
    if (!parent) return true;
    return Boolean(parent.closest("script,style,noscript,textarea,input,template,[contenteditable='true']"));
  }

  function formatTextNode(node) {
    if (!node || node.nodeType !== Node.TEXT_NODE || shouldSkip(node)) return;
    const before = node.nodeValue;
    const after = transformText(before);
    if (after !== before) node.nodeValue = after;
  }

  function scan(root = document.body) {
    if (!root) return;
    if (root.nodeType === Node.TEXT_NODE) {
      formatTextNode(root);
      return;
    }

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) formatTextNode(node);
  }

  function normalizeDateInputs(root = document) {
    // Native date inputs keep their machine-readable YYYY-MM-DD value.
    // en-GB asks browsers to present the picker in day/month/year order.
    document.documentElement.lang = "en-GB";
    root.querySelectorAll?.('input[type="date"]').forEach((input) => {
      input.setAttribute("aria-label", input.getAttribute("aria-label") || "Date (DD/MM/YYYY)");
      input.title = "DD/MM/YYYY";
    });
  }

  function apply(root = document.body) {
    scan(root);
    normalizeDateInputs(root.nodeType === Node.DOCUMENT_NODE ? root : document);
  }

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === "characterData") {
        formatTextNode(mutation.target);
        continue;
      }
      for (const node of mutation.addedNodes) apply(node);
    }
  });

  function start() {
    apply(document.body);
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      characterData: true
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();