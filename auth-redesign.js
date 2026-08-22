(() => {
  "use strict";
  if (window.__MEDORA_AUTH_REDESIGN__) return;
  window.__MEDORA_AUTH_REDESIGN__ = true;

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  function addStyles() {
    if ($("#medoraAuthRedesignStyle")) return;
    const style = document.createElement("style");
    style.id = "medoraAuthRedesignStyle";
    style.textContent = `
      #authView.auth-shell{
        min-height:100svh;
        grid-template-columns:minmax(520px,1.08fr) minmax(500px,.92fr);
        background:#f7f9fd;
      }
      #authView .auth-brand{
        isolation:isolate;
        min-height:100svh;
        padding:clamp(42px,5vw,82px) clamp(44px,5.5vw,88px);
        background:
          radial-gradient(circle at 88% 54%,rgba(63,98,255,.27),transparent 27%),
          radial-gradient(circle at 67% 88%,rgba(138,71,244,.34),transparent 33%),
          radial-gradient(circle at 8% 100%,rgba(11,190,199,.24),transparent 32%),
          linear-gradient(145deg,#071328 0%,#0c1938 48%,#151a48 100%);
      }
      #authView .auth-brand::before{
        content:"";
        position:absolute;
        z-index:-1;
        width:78%;
        height:58%;
        right:-9%;
        bottom:3%;
        border-radius:50% 0 0 50%;
        border:1px solid rgba(119,134,255,.20);
        transform:rotate(-8deg);
        box-shadow:
          0 0 0 70px rgba(97,107,244,.035),
          0 0 0 145px rgba(97,107,244,.025),
          inset 0 0 90px rgba(31,211,213,.035);
      }
      #authView .auth-brand::after{
        content:"";
        position:absolute;
        z-index:-1;
        width:64%;
        height:2px;
        left:8%;
        bottom:9%;
        border-radius:999px;
        background:linear-gradient(90deg,transparent,#18d4ce 28%,#7078ff 62%,#a555ff 82%,transparent);
        box-shadow:0 0 24px #21c9db,0 0 54px #704dff;
        opacity:.72;
      }
      #authView .brand-lockup{align-self:flex-start;gap:16px}
      #authView .brand-mark-large{width:62px;height:62px;filter:drop-shadow(0 10px 24px rgba(72,103,255,.28))}
      #authView .brand-name-large{font-size:36px;letter-spacing:-.045em;font-weight:760}
      #authView .brand-tagline{font-size:12px;font-weight:680}
      #authView .auth-copy{max-width:790px;margin-top:auto;margin-bottom:auto;padding:34px 0 28px}
      #authView .auth-copy .eyebrow{
        color:rgba(223,231,255,.69);
        font-size:11px;
        letter-spacing:.22em;
      }
      #authView .auth-copy h1{
        max-width:780px;
        margin:20px 0 22px;
        font-family:ui-serif,Georgia,"Times New Roman",serif;
        font-size:clamp(58px,6vw,94px);
        font-weight:500;
        line-height:.98;
        letter-spacing:-.055em;
        text-wrap:balance;
      }
      #authView .auth-copy h1 .auth-gradient-word{
        background:linear-gradient(105deg,#20ddd0 4%,#4a9aff 48%,#9b59f6 92%);
        color:transparent;
        -webkit-background-clip:text;
        background-clip:text;
        text-shadow:0 15px 46px rgba(74,126,255,.11);
      }
      #authView .auth-copy p{
        max-width:650px;
        color:rgba(232,237,255,.72);
        font-size:17px;
        line-height:1.65;
      }
      #authView .feature-grid{gap:14px;max-width:820px}
      #authView .feature-grid article{
        position:relative;
        min-height:194px;
        display:flex;
        flex-direction:column;
        padding:22px;
        border-color:rgba(180,196,255,.16);
        background:linear-gradient(150deg,rgba(255,255,255,.07),rgba(255,255,255,.025));
        box-shadow:inset 0 1px rgba(255,255,255,.05),0 18px 45px rgba(0,0,0,.10);
        backdrop-filter:blur(16px);
      }
      #authView .feature-grid article::after{
        content:"";
        position:absolute;
        inset:auto 12% 0;
        height:1px;
        background:linear-gradient(90deg,transparent,rgba(50,221,216,.85),rgba(124,90,255,.75),transparent);
        box-shadow:0 0 17px rgba(70,169,255,.55);
        opacity:.7;
      }
      #authView .auth-feature-icon{
        width:46px;height:46px;
        display:grid;place-items:center;
        margin-bottom:25px;
        border:1px solid rgba(151,183,255,.22);
        border-radius:50%;
        background:linear-gradient(145deg,rgba(20,210,196,.12),rgba(111,92,244,.15));
        color:#7de6dd;
        font-size:21px;
        box-shadow:inset 0 0 18px rgba(75,133,255,.08);
      }
      #authView .feature-grid article:nth-child(2) .auth-feature-icon{color:#8ca8ff}
      #authView .feature-grid article:nth-child(3) .auth-feature-icon{color:#be8dff}
      #authView .feature-grid article>span:not(.auth-feature-icon){display:none}
      #authView .feature-grid strong{font-size:14px;margin-top:auto}
      #authView .feature-grid small{font-size:11px;line-height:1.6;color:rgba(231,236,255,.57)}

      #authView .auth-panel{
        position:relative;
        overflow:hidden;
        padding:clamp(26px,4vw,58px);
        background:
          radial-gradient(circle at 18% 8%,rgba(115,139,255,.10),transparent 28%),
          radial-gradient(circle at 90% 90%,rgba(27,198,183,.07),transparent 28%),
          #f8faff;
      }
      #authView .auth-panel::before{
        content:"";
        position:absolute;
        width:360px;height:360px;
        right:-190px;top:-170px;
        border-radius:50%;
        border:1px solid rgba(102,128,255,.09);
        box-shadow:0 0 0 60px rgba(102,128,255,.025),0 0 0 120px rgba(102,128,255,.018);
      }
      #authView .auth-card{
        position:relative;
        width:min(100%,610px);
        padding:clamp(34px,4.5vw,58px);
        border:1px solid rgba(211,219,235,.92);
        border-radius:32px;
        background:rgba(255,255,255,.92);
        box-shadow:0 30px 90px rgba(34,48,83,.13),inset 0 1px #fff;
        backdrop-filter:blur(24px);
      }
      #authView .auth-heading .eyebrow{
        color:#5b6ae8;
        font-size:10px;
        letter-spacing:.08em;
      }
      #authView .auth-heading h2{
        margin:10px 0 7px;
        font-family:ui-serif,Georgia,"Times New Roman",serif;
        color:#101a38;
        font-size:clamp(34px,3vw,45px);
        font-weight:600;
        letter-spacing:-.045em;
      }
      #authView .auth-heading p{color:#78839b;font-size:14px}
      #authView .segmented{
        gap:5px;
        margin:28px 0 25px;
        padding:4px;
        border:1px solid #e5e9f1;
        border-radius:14px;
        background:#f4f6fa;
      }
      #authView .segment{
        min-height:45px;
        border-radius:10px;
        font-size:13px;
        transition:.22s ease;
      }
      #authView .segment.active{
        color:white;
        background:linear-gradient(108deg,#18bcb3,#4e8bf5 52%,#8c45eb);
        box-shadow:0 8px 20px rgba(91,92,232,.22);
      }
      #authView .auth-form{gap:15px}
      #authView .auth-form label>span:first-child{color:#33405b;font-size:11px;font-weight:820}
      #authView .auth-input-shell{position:relative}
      #authView .auth-input-shell input{
        min-height:53px;
        padding-left:44px;
        padding-right:44px;
        border-color:#dce3ee;
        border-radius:12px;
        background:rgba(255,255,255,.96);
        box-shadow:0 4px 13px rgba(42,55,84,.035);
      }
      #authView .auth-input-shell input:focus{
        border-color:#8293f8;
        box-shadow:0 0 0 4px rgba(101,124,243,.10),0 8px 24px rgba(58,79,137,.06);
      }
      #authView .auth-field-icon{
        position:absolute;
        left:14px;top:50%;transform:translateY(-50%);
        width:19px;height:19px;
        display:grid;place-items:center;
        color:#7885a1;
        pointer-events:none;
      }
      #authView .auth-field-icon svg{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
      #authView .auth-password-toggle{
        position:absolute;
        right:10px;top:50%;transform:translateY(-50%);
        width:34px;height:34px;
        display:grid;place-items:center;
        border:0;border-radius:9px;
        background:transparent;
        color:#7a87a1;
      }
      #authView .auth-password-toggle:hover{background:#f2f4f9;color:#55637e}
      #authView .auth-password-toggle svg{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:1.8}
      #authView .primary-button[type="submit"]{
        min-height:57px;
        margin-top:3px;
        padding:0 19px;
        border-radius:12px;
        background:linear-gradient(110deg,#13bbb3 0%,#4d8ef2 48%,#8d43ef 100%);
        box-shadow:0 14px 32px rgba(83,93,232,.25);
        font-size:13px;
        transition:transform .18s ease,box-shadow .18s ease;
      }
      #authView .primary-button[type="submit"]:hover{transform:translateY(-1px);box-shadow:0 18px 38px rgba(83,93,232,.31)}
      #authView .auth-footnote{
        display:grid;
        grid-template-columns:auto 1fr;
        gap:12px;
        align-items:center;
        margin-top:25px;
        padding-top:22px;
        color:#7e899d;
        font-size:10px;
      }
      #authView .auth-trust-icon{
        width:40px;height:40px;
        display:grid;place-items:center;
        border-radius:50%;
        color:#6075ef;
        background:linear-gradient(145deg,#eef5ff,#f2edff);
        box-shadow:inset 0 0 0 1px #e6e9fa;
      }
      #authView .auth-trust-icon svg{width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:1.8}
      #authView .auth-trust-copy strong{display:block;margin-bottom:3px;color:#33405b;font-size:10px}
      #authView .auth-trust-copy span{display:block;line-height:1.45}
      #authView .mobile-brand{margin-bottom:30px}

      @media(max-width:1100px){
        #authView.auth-shell{grid-template-columns:minmax(420px,.9fr) minmax(470px,1.1fr)}
        #authView .auth-brand{padding:45px 42px}
        #authView .auth-copy h1{font-size:60px}
        #authView .feature-grid{grid-template-columns:1fr;gap:9px}
        #authView .feature-grid article{min-height:auto;display:grid;grid-template-columns:auto 1fr;column-gap:13px;align-items:center;padding:15px}
        #authView .auth-feature-icon{grid-row:1/3;margin:0}
        #authView .feature-grid strong{margin:0}
        #authView .feature-grid small{margin-top:3px}
      }
      @media(max-width:820px){
        #authView.auth-shell{display:block;min-height:100svh;background:linear-gradient(155deg,#071328,#101b43 48%,#f5f7fb 48%)}
        #authView .auth-brand{display:none}
        #authView .auth-panel{min-height:100svh;padding:20px;background:radial-gradient(circle at 50% 0,rgba(98,103,241,.14),transparent 32%),#f6f8fc}
        #authView .auth-card{width:min(100%,560px);padding:28px 24px;border-radius:25px}
        #authView .mobile-brand{display:flex}
        #authView .auth-heading h2{font-size:34px}
      }
      @media(max-width:480px){
        #authView .auth-panel{padding:0;background:#fff}
        #authView .auth-card{min-height:100svh;width:100%;padding:28px 20px;border:0;border-radius:0;box-shadow:none}
        #authView .brand-name{font-size:23px}
        #authView .auth-heading{margin-top:34px}
        #authView .auth-heading h2{font-size:32px}
        #authView .auth-footnote{margin-top:20px}
      }
    `;
    document.head.appendChild(style);
  }

  const icons = {
    person: `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3.2"></circle><path d="M5.5 20c.5-4.2 2.7-6.3 6.5-6.3s6 2.1 6.5 6.3"></path></svg>`,
    mail: `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="5.5" width="17" height="13" rx="2.2"></rect><path d="m5 7 7 5.4L19 7"></path></svg>`,
    lock: `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="10" width="14" height="10" rx="2.2"></rect><path d="M8.5 10V7.5a3.5 3.5 0 0 1 7 0V10"></path></svg>`,
    eye: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.8 12s3.2-5 9.2-5 9.2 5 9.2 5-3.2 5-9.2 5-9.2-5-9.2-5Z"></path><circle cx="12" cy="12" r="2.4"></circle></svg>`,
    shield: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 19 6v5.2c0 4.7-2.7 7.8-7 9.8-4.3-2-7-5.1-7-9.8V6l7-3Z"></path><path d="m9 12 2 2 4-4"></path></svg>`
  };

  function wrapInput(id, iconName, password = false) {
    const input = document.getElementById(id);
    if (!input || input.closest(".auth-input-shell")) return;
    const shell = document.createElement("div");
    shell.className = "auth-input-shell";
    input.parentNode.insertBefore(shell, input);
    shell.appendChild(input);

    const icon = document.createElement("span");
    icon.className = "auth-field-icon";
    icon.innerHTML = icons[iconName] || "";
    shell.insertBefore(icon, input);

    if (password) {
      const toggle = document.createElement("button");
      toggle.type = "button";
      toggle.className = "auth-password-toggle";
      toggle.setAttribute("aria-label", "Show password");
      toggle.title = "Show password";
      toggle.innerHTML = icons.eye;
      toggle.addEventListener("click", () => {
        const showing = input.type === "text";
        input.type = showing ? "password" : "text";
        toggle.setAttribute("aria-label", showing ? "Show password" : "Hide password");
        toggle.title = showing ? "Show password" : "Hide password";
      });
      shell.appendChild(toggle);
    }
  }

  function upgradeContent() {
    const headline = $("#authView .auth-copy h1");
    if (headline && !headline.querySelector(".auth-gradient-word")) {
      headline.innerHTML = `Make room for<br><span class="auth-gradient-word">what matters.</span>`;
    }

    const features = $$("#authView .feature-grid article");
    const featureIcons = ["▣", "◎", "♧"];
    features.forEach((card, i) => {
      if (card.querySelector(".auth-feature-icon")) return;
      const icon = document.createElement("span");
      icon.className = "auth-feature-icon";
      icon.setAttribute("aria-hidden", "true");
      icon.textContent = featureIcons[i] || "✦";
      card.insertBefore(icon, card.firstChild);
    });

    wrapInput("signInEmail", "mail");
    wrapInput("signInPassword", "lock", true);
    wrapInput("signUpName", "person");
    wrapInput("signUpEmail", "mail");
    wrapInput("signUpPassword", "lock", true);

    const foot = $("#authView .auth-footnote");
    if (foot && !foot.querySelector(".auth-trust-icon")) {
      foot.innerHTML = `<span class="auth-trust-icon">${icons.shield}</span><span class="auth-trust-copy"><strong>Your privacy is part of the design.</strong><span>Secure authentication and row-level protection keep your private Medora data yours.</span></span>`;
    }
  }

  function init() {
    addStyles();
    upgradeContent();
    new MutationObserver(() => upgradeContent()).observe(document.body, { childList:true, subtree:true });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once:true });
  else init();
})();