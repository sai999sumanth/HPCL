import React, { useEffect } from 'react';

// const GPT_BASE = 'http://localhost:9090';
const GPT_BASE = 'https://gpt.hpcl.co.in';
const TAS_GPT_STYLE_ID = 'tas-gpt-theme-overrides';
const TAS_GPT_SCRIPT_SELECTOR = 'script[data-tas-gpt-loader="true"]';
const TAS_GPT_BODY_CLASS = 'tas-gpt-active';
const TAS_GPT_CHAT_OPEN_CLASS = 'tas-gpt-chat-open';
const TAS_GPT_CONFIG_VERSION = 'palette-v6';

/** Shared HPCL blue palette — launcher + light/dark chat */
const C = {
  primary: '#037CC2',
  primaryDark: '#024991',
  primaryDeeper: '#013a6b',
  primaryLight: '#4DA3D9',
  primarySoft: '#7EC4EA',
  white: '#FFFFFF',
  lightBg: '#F4F9FD',
  lightFooter: '#E8F2FA',
  lightFooterText: '#5B7A94',
  lightBotBg: '#E3F0FA',
  lightBotText: '#014A7A',
  darkBg: '#0B1220',
  darkFooter: '#152A40',
  darkFooterText: '#A8C4DA',
  darkPlaceholder: '#6B8FA8',
  darkBotBg: '#1A3352',
  darkBotText: '#DCEEFB',
  darkUserBg: '#0B6BAF',
  sendLight: '#024991',
  sendDark: '#7EC4EA',
  fontSize: '18px',
  launcherFontSize: '18px',
} as const;

const CHAT_ICON_SVG = encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>'
);

let activeMountCount = 0;
let hideTimer: ReturnType<typeof setTimeout> | null = null;

const playLauncherAnimation = () => {
  const launcher = document.querySelector(
    '[id^="fluid-gpt-chatbot-icon-container"]'
  ) as HTMLElement | null;
  if (!launcher) return false;

  launcher.classList.remove('tas-gpt-enter');
  void launcher.offsetWidth;
  launcher.classList.add('tas-gpt-enter');
  return true;
};

const waitForLauncherAndAnimate = () => {
  if (playLauncherAnimation()) return;

  let attempts = 0;
  const timer = setInterval(() => {
    attempts += 1;
    if (playLauncherAnimation() || attempts >= 40) {
      clearInterval(timer);
    }
  }, 100);
};

const showTasGpt = () => {
  if (hideTimer) {
    clearTimeout(hideTimer);
    hideTimer = null;
  }
  document.body.classList.add(TAS_GPT_BODY_CLASS);
  requestAnimationFrame(() => {
    waitForLauncherAndAnimate();
  });
};

const scheduleHideTasGpt = () => {
  if (hideTimer) clearTimeout(hideTimer);
  hideTimer = setTimeout(() => {
    hideTimer = null;
    if (activeMountCount <= 0) {
      document.body.classList.remove(TAS_GPT_BODY_CLASS);
      document.body.classList.remove(TAS_GPT_CHAT_OPEN_CLASS);
    }
  }, 0);
};

const watchChatOpenState = () => {
  const syncOpenState = () => {
    const iframe = document.querySelector(
      '[id^="fluid-gpt-chatbot-interface-iframe"]'
    ) as HTMLElement | null;
    if (!iframe) return;

    const isOpen =
      iframe.offsetParent !== null &&
      getComputedStyle(iframe).display !== 'none' &&
      getComputedStyle(iframe).visibility !== 'hidden' &&
      Number(getComputedStyle(iframe).opacity) > 0.05;

    document.body.classList.toggle(TAS_GPT_CHAT_OPEN_CLASS, isOpen);
  };

  syncOpenState();
  const observer = new MutationObserver(syncOpenState);
  observer.observe(document.body, {
    attributes: true,
    attributeFilter: ['class', 'style'],
    childList: true,
    subtree: true,
  });

  return () => observer.disconnect();
};

const injectTasGptTheme = () => {
  document.getElementById(TAS_GPT_STYLE_ID)?.remove();

  const style = document.createElement('style');
  style.id = TAS_GPT_STYLE_ID;
  style.textContent = `
    body:not(.${TAS_GPT_BODY_CLASS}) [id^="fluid-gpt-"] {
      opacity: 0 !important;
      visibility: hidden !important;
      pointer-events: none !important;
      transform: translateY(18px) scale(0.9) !important;
      transition:
        opacity 0.28s ease,
        transform 0.28s ease,
        visibility 0.28s ease !important;
    }

    @keyframes tas-gpt-circle-enter {
      0% {
        opacity: 0;
        transform: scale(0.35) translateY(24px);
      }
      65% {
        opacity: 1;
        transform: scale(1.1) translateY(-4px);
      }
      100% {
        opacity: 1;
        transform: scale(1) translateY(0);
      }
    }

    @keyframes tas-gpt-pill-enter {
      0% {
        opacity: 0;
        transform: translateY(22px) scale(0.88);
      }
      60% {
        opacity: 1;
        transform: translateY(-4px) scale(1.03);
      }
      100% {
        opacity: 1;
        transform: translateY(0) scale(1);
      }
    }

    @keyframes tas-gpt-float {
      0%, 100% { transform: translateY(0) scale(1); }
      50% { transform: translateY(-6px) scale(1); }
    }

    @keyframes tas-gpt-glow {
      0%, 100% {
        box-shadow: 0 8px 26px rgba(3, 124, 194, 0.38);
      }
      50% {
        box-shadow:
          0 12px 34px rgba(3, 124, 194, 0.5),
          0 0 0 7px rgba(77, 163, 217, 0.18);
      }
    }

    @keyframes tas-gpt-chat-open {
      from {
        opacity: 0;
        transform: translateY(24px) scale(0.95);
      }
      to {
        opacity: 1;
        transform: translateY(0) scale(1);
      }
    }

    /* Collapsed: circular gradient FAB with chat icon only */
    [id^="fluid-gpt-chatbot-icon-container"] {
      cursor: pointer !important;
      display: inline-flex !important;
      flex-direction: row !important;
      align-items: center !important;
      justify-content: center !important;
      gap: 0 !important;
      width: 56px !important;
      height: 56px !important;
      min-width: 56px !important;
      padding: 0 !important;
      border-radius: 50% !important;
      background: linear-gradient(135deg, ${C.primaryDeeper} 0%, ${C.primary} 52%, ${C.primarySoft} 100%) !important;
      border: none !important;
      opacity: 1 !important;
      visibility: visible !important;
      overflow: hidden !important;
      transition:
        width 0.35s cubic-bezier(0.22, 1, 0.36, 1),
        min-width 0.35s cubic-bezier(0.22, 1, 0.36, 1),
        padding 0.35s cubic-bezier(0.22, 1, 0.36, 1),
        border-radius 0.35s cubic-bezier(0.22, 1, 0.36, 1),
        background 0.35s ease,
        box-shadow 0.25s ease,
        transform 0.25s ease !important;
      animation:
        tas-gpt-float 3.4s ease-in-out 0.8s infinite,
        tas-gpt-glow 2.8s ease-in-out 0.8s infinite !important;
    }

    [id^="fluid-gpt-chatbot-icon-container"]::before {
      content: '';
      display: block;
      width: 26px;
      height: 26px;
      flex-shrink: 0;
      background: center / contain no-repeat url("data:image/svg+xml,${CHAT_ICON_SVG}");
    }

    [id^="fluid-gpt-chatbot-icon-container"].tas-gpt-enter {
      animation:
        tas-gpt-circle-enter 0.6s cubic-bezier(0.22, 1, 0.36, 1) both,
        tas-gpt-float 3.4s ease-in-out 0.8s infinite,
        tas-gpt-glow 2.8s ease-in-out 0.8s infinite !important;
    }

    /* Hover: expand pill + show "TAS GPT" label */
    [id^="fluid-gpt-chatbot-icon-container"]:hover {
      width: auto !important;
      min-width: unset !important;
      height: auto !important;
      padding: 12px 20px 12px 16px !important;
      border-radius: 9999px !important;
      justify-content: flex-start !important;
      gap: 10px !important;
      background: linear-gradient(90deg, ${C.primaryDeeper} 0%, ${C.primary} 50%, ${C.primaryLight} 100%) !important;
      animation: none !important;
      transform: translateY(-3px) scale(1.03) !important;
      box-shadow: 0 12px 32px rgba(3, 124, 194, 0.42) !important;
    }

    /* Open chat: HPCL blue pill when launcher is still visible */
    body.${TAS_GPT_CHAT_OPEN_CLASS} [id^="fluid-gpt-chatbot-icon-container"] {
      background: linear-gradient(135deg, ${C.primary} 0%, ${C.primaryDark} 100%) !important;
      box-shadow: 0 12px 32px rgba(3, 124, 194, 0.4) !important;
    }

    [id^="fluid-gpt-chatbot-icon_"] {
      display: none !important;
    }

    [id^="fluid-gpt-message-container"] {
      margin: 0 !important;
      padding: 0 !important;
      border: none !important;
      border-radius: 0 !important;
      background: transparent !important;
      box-shadow: none !important;
      color: ${C.white} !important;
      font-weight: 700 !important;
      letter-spacing: 0.04em;
      line-height: 1.3 !important;
      display: inline-block !important;
      white-space: nowrap;
      width: 0 !important;
      max-width: 0 !important;
      opacity: 0 !important;
      overflow: hidden !important;
      font-size: 0 !important;
      transition:
        max-width 0.35s cubic-bezier(0.22, 1, 0.36, 1),
        opacity 0.28s ease,
        font-size 0.2s ease !important;
    }

    [id^="fluid-gpt-chatbot-icon-container"]:hover [id^="fluid-gpt-message-container"] {
      width: auto !important;
      max-width: 180px !important;
      opacity: 1 !important;
      font-size: ${C.launcherFontSize} !important;
    }

    [id^="fluid-gpt-message-container"] img {
      display: none !important;
    }

    [id^="fluid-gpt-message-container"]::before {
      display: none !important;
    }

    /* Chat panel — blue theme when open */
    [id^="fluid-gpt-chatbot-interface-iframe"] {
      border-radius: 16px !important;
      border: 2px solid ${C.primary} !important;
      box-shadow: 0 24px 52px rgba(3, 124, 194, 0.28) !important;
      animation: tas-gpt-chat-open 0.42s cubic-bezier(0.22, 1, 0.36, 1) both !important;
    }

    body.${TAS_GPT_CHAT_OPEN_CLASS} [id^="fluid-gpt-chatbot-interface-iframe"] {
      border-color: ${C.primaryLight} !important;
      box-shadow: 0 28px 56px rgba(3, 124, 194, 0.34) !important;
    }
  `;

  document.head.appendChild(style);
};

const resetFluidGptEmbed = () => {
  document.querySelectorAll('[id^="fluid-gpt-"]').forEach((node) => node.remove());
  document.querySelectorAll('script[src*="fluid-gpt.js"]').forEach((node) => node.remove());
  document.querySelectorAll('style').forEach((style) => {
    const text = style.textContent ?? '';
    if (
      text.includes('fluid-gpt-chatbot-icon-container') ||
      text.includes('fluid-gpt-chatbot-interface-iframe')
    ) {
      style.remove();
    }
  });
};

const loadFluidGptScriptOnce = () => {
  const existing = document.querySelector(
    TAS_GPT_SCRIPT_SELECTOR
  ) as HTMLScriptElement | null;

  if (existing?.dataset.configVersion === TAS_GPT_CONFIG_VERSION) return;
  if (existing) resetFluidGptEmbed();

  const script = document.createElement('script');
  script.dataset.tasGptLoader = 'true';
  script.dataset.configVersion = TAS_GPT_CONFIG_VERSION;
  script.src = `${GPT_BASE}/embedded-bot/integration/fluid-gpt.js`;
  script.async = false;
  script.setAttribute('delayBotLoad', '0');
  script.setAttribute('chatBotUrl', `${GPT_BASE}/embedded-bot/?tenant=hpcl`);
  script.setAttribute('welcomeMsg', 'TAS GPT');
  script.setAttribute('logoUrl', `${GPT_BASE}/embedded-bot/images/logo.png`);
  script.setAttribute('showReferences', 'true');
  script.setAttribute('showFeedback', 'true');
  script.setAttribute('tenant', 'hpcl');
  script.setAttribute('accessPrivateFolder', 'false');
  script.setAttribute(
    'chatBotGreetingMsg',
    'Trained on TAS FDS, OEM Manuals and various TAS related circulars.'
  );
  script.setAttribute('workflowName', 'SOD TAS - GPT');
  script.setAttribute('botName', 'TAS-GPT');
  script.setAttribute('fontStyle', `font-size: ${C.fontSize}; line-height: 1.5`);
  script.setAttribute('headerColor', C.primary);
  script.setAttribute('baseUrl', `${GPT_BASE}/backend/hpcl/public-embed`);
  script.setAttribute('darkHeaderColor', C.primaryDark);
  script.setAttribute('headerTextColor', C.white);
  script.setAttribute('darkHeaderTextColor', C.white);
  script.setAttribute('footerColor', C.lightFooter);
  script.setAttribute('darkFooterColor', C.darkFooter);
  script.setAttribute('footerTextColor', C.lightFooterText);
  script.setAttribute('darkFooterTextColor', C.darkFooterText);
  script.setAttribute('footerPlaceholderColor', C.lightFooterText);
  script.setAttribute('darkFooterPlaceholderColor', C.darkPlaceholder);
  script.setAttribute('bodyBackgroundColor', C.lightBg);
  script.setAttribute('darkBodyBackgroundColor', C.darkBg);
  script.setAttribute('botMessageBackgroundColor', C.lightBotBg);
  script.setAttribute('darkBotMessageBackgroundColor', C.darkBotBg);
  script.setAttribute('botMessageTextColor', C.lightBotText);
  script.setAttribute('darkBotMessageTextColor', C.darkBotText);
  script.setAttribute('userMessageTextColor', C.white);
  script.setAttribute('darkUserMessageTextColor', C.white);
  script.setAttribute('userMessageBackgroundColor', C.primary);
  script.setAttribute('darkUserMessageBackgroundColor', C.darkUserBg);
  script.setAttribute('sendButtonColor', C.sendLight);
  script.setAttribute('darkSendButtonColor', C.sendDark);
  script.setAttribute('autoOpen', 'false');

  document.body.appendChild(script);
};

/**
 * GPT is loaded once; visibility toggles with route via body.tas-gpt-active.
 * Shows immediately when navigating between pages that render <TASGpt />.
 */
const TASGpt: React.FC = () => {
  useEffect(() => {
    activeMountCount += 1;
    injectTasGptTheme();
    loadFluidGptScriptOnce();
    showTasGpt();
    const stopWatchingChat = watchChatOpenState();

    return () => {
      activeMountCount = Math.max(0, activeMountCount - 1);
      stopWatchingChat();
      scheduleHideTasGpt();
    };
  }, []);

  return null;
};

export default TASGpt;
