(() => {
  "use strict";
  if (window.__MEDORA_CHECKIN_INDICATIONS__) return;
  window.__MEDORA_CHECKIN_INDICATIONS__ = true;

  const style = document.createElement("style");
  style.id = "medoraCheckinIndicationsStyle";
  style.textContent = `
    .lm-checks button[data-check]{
      border:1px solid transparent!important;
      font-weight:850!important;
      transition:background .15s ease,color .15s ease,border-color .15s ease,transform .15s ease!important;
    }

    .lm-checks button[data-check="done"]{
      background:#eaf8f1!important;
      color:#147a57!important;
      border-color:#bfe8d4!important;
    }
    .lm-checks button[data-check="done"]:hover{
      background:#dff4ea!important;
      transform:translateY(-1px);
    }
    .lm-checks button[data-check="done"].selected{
      background:#209c6a!important;
      color:#fff!important;
      border-color:#209c6a!important;
      box-shadow:0 4px 12px rgba(32,156,106,.20)!important;
    }

    .lm-checks button[data-check="partial"]{
      background:#fff7e6!important;
      color:#9a6610!important;
      border-color:#f1d795!important;
    }
    .lm-checks button[data-check="partial"]:hover{
      background:#fff1cf!important;
      transform:translateY(-1px);
    }
    .lm-checks button[data-check="partial"].selected{
      background:#d99a22!important;
      color:#fff!important;
      border-color:#d99a22!important;
      box-shadow:0 4px 12px rgba(217,154,34,.20)!important;
    }

    .lm-checks button[data-check="missed"]{
      background:#fff0f2!important;
      color:#aa4054!important;
      border-color:#f0c3cc!important;
    }
    .lm-checks button[data-check="missed"]::before{
      content:"✕ ";
      font-weight:900;
    }
    .lm-checks button[data-check="missed"]:hover{
      background:#ffe5e9!important;
      transform:translateY(-1px);
    }
    .lm-checks button[data-check="missed"].selected{
      background:#d85469!important;
      color:#fff!important;
      border-color:#d85469!important;
      box-shadow:0 4px 12px rgba(216,84,105,.20)!important;
    }

    .lm-checks button[data-check="bonus"]{
      background:#f1edff!important;
      color:#6754c7!important;
      border-color:#d8ceff!important;
    }
    .lm-checks button[data-check="bonus"]:hover{
      background:#e9e2ff!important;
      transform:translateY(-1px);
    }
    .lm-checks button[data-check="bonus"].selected{
      background:#705ccf!important;
      color:#fff!important;
      border-color:#705ccf!important;
      box-shadow:0 4px 12px rgba(112,92,207,.20)!important;
    }
  `;
  document.head.appendChild(style);
})();