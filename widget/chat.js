(function () {
  'use strict';

  // ── Config ──────────────────────────────────────────────────────────────────
  // Set window.KormoanAgentConfig BEFORE loading this script to override defaults
  var cfg = window.KormoanAgentConfig || {};
  var API_URL = cfg.apiUrl || 'https://YOUR_SERVER_URL/api/chat'; // ← update after deploy
  var WELCOME_MSG = cfg.welcomeMessage || "Hi! I'm Kormoan Agent. Ask me anything about our services, work, or how we can help you.";
  var PLACEHOLDER = cfg.placeholder || 'Ask about our services...';

  // ── Session ─────────────────────────────────────────────────────────────────
  function getSessionId() {
    var key = 'kormoan_agent_session';
    var id = localStorage.getItem(key);
    if (!id) {
      id = 'ks_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
      localStorage.setItem(key, id);
    }
    return id;
  }

  // ── CSS injection ────────────────────────────────────────────────────────────
  function injectStyles() {
    var cssUrl = (cfg.cssUrl || API_URL.replace('/api/chat', '')) + '/widget/chat.css';
    // If relative path used, resolve from script src
    var scripts = document.querySelectorAll('script[src*="chat.js"]');
    if (scripts.length) {
      var base = scripts[scripts.length - 1].src.replace('chat.js', '');
      cssUrl = base + 'chat.css';
    }
    var link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = cssUrl;
    document.head.appendChild(link);
  }

  // ── Icons ────────────────────────────────────────────────────────────────────
  var CHAT_ICON = '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>';
  var SEND_ICON = '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>';
  var CLOSE_ICON = '×';

  // ── Build DOM ────────────────────────────────────────────────────────────────
  function buildWidget() {
    var wrapper = document.createElement('div');
    wrapper.id = 'kormoan-agent-widget';

    wrapper.innerHTML =
      '<button id="kormoan-agent-btn" aria-label="Chat with Kormoan Agent">' + CHAT_ICON + '</button>' +

      '<div id="kormoan-agent-window" class="hidden" role="dialog" aria-label="Kormoan Agent Chat">' +

        '<div id="kormoan-agent-header">' +
          '<div class="ka-avatar">K</div>' +
          '<div class="ka-info">' +
            '<div class="ka-name">Kormoan Agent</div>' +
            '<div class="ka-status">Online</div>' +
          '</div>' +
          '<button id="kormoan-agent-close" aria-label="Close chat">' + CLOSE_ICON + '</button>' +
        '</div>' +

        '<div id="kormoan-agent-messages" role="log" aria-live="polite"></div>' +

        '<div id="kormoan-agent-input-area">' +
          '<textarea id="kormoan-agent-input" rows="1" placeholder="' + PLACEHOLDER + '" maxlength="1000" aria-label="Type your message"></textarea>' +
          '<button id="kormoan-agent-send" aria-label="Send message">' + SEND_ICON + '</button>' +
        '</div>' +

        '<div id="kormoan-agent-footer">Powered by <a href="https://www.kormoan.in" target="_blank">Kormoan</a></div>' +

      '</div>';

    document.body.appendChild(wrapper);
  }

  // ── Message rendering ────────────────────────────────────────────────────────
  var messagesEl, inputEl, sendBtn;
  var isLoading = false;

  function escapeHtml(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function formatMessage(text) {
    // Basic markdown: **bold**, *italic*, `code`, line breaks
    return escapeHtml(text)
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/`(.+?)`/g, '<code style="background:#f0f0f0;padding:1px 5px;border-radius:4px;font-size:12px">$1</code>')
      .replace(/\n/g, '<br>');
  }

  function appendMessage(role, text) {
    var div = document.createElement('div');
    div.className = 'ka-msg ' + (role === 'user' ? 'ka-msg-user' : 'ka-msg-bot');

    var bubble = document.createElement('div');
    bubble.className = 'ka-bubble';
    bubble.innerHTML = formatMessage(text);

    div.appendChild(bubble);
    messagesEl.appendChild(div);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    return div;
  }

  function showTyping() {
    var div = document.createElement('div');
    div.className = 'ka-msg ka-msg-bot ka-typing';
    div.id = 'ka-typing-indicator';
    div.innerHTML = '<div class="ka-bubble"><span class="ka-dot"></span><span class="ka-dot"></span><span class="ka-dot"></span></div>';
    messagesEl.appendChild(div);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function removeTyping() {
    var el = document.getElementById('ka-typing-indicator');
    if (el) el.remove();
  }

  // ── API call ─────────────────────────────────────────────────────────────────
  function sendMessage() {
    if (isLoading) return;
    var text = inputEl.value.trim();
    if (!text) return;

    inputEl.value = '';
    inputEl.style.height = 'auto';
    appendMessage('user', text);

    isLoading = true;
    sendBtn.disabled = true;
    showTyping();

    fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: getSessionId(),
        message: text,
        pageUrl: window.location.href,
      }),
    })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        removeTyping();
        if (data.response) {
          appendMessage('bot', data.response);
        } else {
          appendMessage('bot', data.error || 'Something went wrong. Please try again.');
        }
      })
      .catch(function () {
        removeTyping();
        appendMessage('bot', "I'm having trouble connecting right now. Please try again in a moment.");
      })
      .finally(function () {
        isLoading = false;
        sendBtn.disabled = false;
        inputEl.focus();
      });
  }

  // ── Toggle ───────────────────────────────────────────────────────────────────
  var isOpen = false;
  var windowEl;

  function openChat() {
    isOpen = true;
    windowEl.classList.remove('hidden');
    inputEl.focus();
    // Show welcome message on first open
    if (messagesEl.children.length === 0) {
      appendMessage('bot', WELCOME_MSG);
    }
  }

  function closeChat() {
    isOpen = false;
    windowEl.classList.add('hidden');
  }

  // ── Init ─────────────────────────────────────────────────────────────────────
  function init() {
    injectStyles();
    buildWidget();

    messagesEl = document.getElementById('kormoan-agent-messages');
    inputEl = document.getElementById('kormoan-agent-input');
    sendBtn = document.getElementById('kormoan-agent-send');
    windowEl = document.getElementById('kormoan-agent-window');

    document.getElementById('kormoan-agent-btn').addEventListener('click', function () {
      isOpen ? closeChat() : openChat();
    });

    document.getElementById('kormoan-agent-close').addEventListener('click', closeChat);

    sendBtn.addEventListener('click', sendMessage);

    inputEl.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });

    // Auto-resize textarea
    inputEl.addEventListener('input', function () {
      this.style.height = 'auto';
      this.style.height = Math.min(this.scrollHeight, 100) + 'px';
    });

    // Close on outside click
    document.addEventListener('click', function (e) {
      if (
        isOpen &&
        !windowEl.contains(e.target) &&
        e.target.id !== 'kormoan-agent-btn' &&
        !document.getElementById('kormoan-agent-btn').contains(e.target)
      ) {
        closeChat();
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
