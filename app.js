/* eslint-disable no-alert */
(() => {
  "use strict";

  const LS = {
    installedAt: "bpd_lab3_installedAt",
    launchCount: "bpd_lab3_launchCount",
    activated: "bpd_lab3_activated",
    settings: "bpd_lab3_settings",
    captchaDb: "bpd_lab4_captchaDb",
  };

  const TRIAL_MAX_LAUNCHES = 10;

  // Caesar cipher (variant requires Caesar). Stable alphabet for keys with letters+digits.
  // Note: '-' is treated as a separator and is NOT shifted.
  const CAESAR_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const CAESAR_SHIFT = 3;

  // Plaintext key is NOT stored. Only encrypted form is stored.
  // Plain key used during development to produce the encrypted constant:
  // "BPD-LAB-3-OK"
  const EXPECTED_KEY_ENC = "ESG-ODE-6-RN"; // caesarEncrypt("BPD-LAB-3-OK", 3)

  const $ = (id) => document.getElementById(id);

  const els = {
    blockedCard: $("blockedCard"),
    workspaceCard: $("workspaceCard"),
    installedAt: $("installedAt"),
    launchCount: $("launchCount"),
    btnActivateFromBlocked: $("btnActivateFromBlocked"),
    btnShowLicenseInfo: $("btnShowLicenseInfo"),

    btnHelp: $("btnHelp"),
    btnAbout: $("btnAbout"),

    fileInput: $("fileInput"),
    btnSave: $("btnSave"),
    btnSaveAs: $("btnSaveAs"),
    btnPrint: $("btnPrint"),
    btnFileProps: $("btnFileProps"),
    btnExportJson: $("btnExportJson"),
    btnClear: $("btnClear"),
    btnSettings: $("btnSettings"),
    btnActivate: $("btnActivate"),
    btnResetDemo: $("btnResetDemo"),

    editor: $("editor"),
    editorStats: $("editorStats"),
    trialStats: $("trialStats"),
    fileNameBadge: $("fileNameBadge"),
    statusBadge: $("statusBadge"),

    searchQuery: $("searchQuery"),
    replaceQuery: $("replaceQuery"),
    btnFindNext: $("btnFindNext"),
    btnFindAll: $("btnFindAll"),
    btnReplaceNext: $("btnReplaceNext"),
    btnReplaceAll: $("btnReplaceAll"),
    searchResult: $("searchResult"),

    modal: $("modal"),
    modalTitle: $("modalTitle"),
    modalBody: $("modalBody"),
    modalActions: $("modalActions"),
  };

  const state = {
    currentFile: null, // { name, type, size, lastModified }
    lastFindIndex: 0,
  };

  // ===== Lab 4: CAPTCHA (image with background + noise) =====
  function ensureCaptchaDb() {
    const existing = safeJsonParse(localStorage.getItem(LS.captchaDb) || "null", null);
    if (existing && Array.isArray(existing) && existing.length >= 12) return existing;

    // "DB" of challenges inside the software: a list of random codes.
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // avoid confusing chars
    const make = () => Array.from({ length: 6 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
    const db = Array.from({ length: 18 }, make);
    localStorage.setItem(LS.captchaDb, JSON.stringify(db));
    return db;
  }

  function pickCaptchaCode() {
    const db = ensureCaptchaDb();
    return db[Math.floor(Math.random() * db.length)];
  }

  function drawCaptcha(canvas, code) {
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;

    // background gradient
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, "rgba(110,231,255,0.22)");
    g.addColorStop(1, "rgba(124,58,237,0.22)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    // background pattern (soft circles)
    for (let i = 0; i < 18; i += 1) {
      ctx.beginPath();
      ctx.fillStyle = `rgba(255,255,255,${0.04 + Math.random() * 0.06})`;
      ctx.arc(Math.random() * w, Math.random() * h, 6 + Math.random() * 22, 0, Math.PI * 2);
      ctx.fill();
    }

    // noise lines
    for (let i = 0; i < 8; i += 1) {
      ctx.strokeStyle = `rgba(0,0,0,${0.12 + Math.random() * 0.18})`;
      ctx.lineWidth = 1 + Math.random() * 1.2;
      ctx.beginPath();
      ctx.moveTo(Math.random() * w, Math.random() * h);
      ctx.bezierCurveTo(Math.random() * w, Math.random() * h, Math.random() * w, Math.random() * h, Math.random() * w, Math.random() * h);
      ctx.stroke();
    }

    // salt & pepper noise
    const img = ctx.getImageData(0, 0, w, h);
    const pixels = img.data;
    const dots = Math.floor((w * h) / 18);
    for (let i = 0; i < dots; i += 1) {
      const p = (Math.floor(Math.random() * w) + Math.floor(Math.random() * h) * w) * 4;
      const v = Math.random() > 0.5 ? 0 : 255;
      pixels[p] = v;
      pixels[p + 1] = v;
      pixels[p + 2] = v;
      pixels[p + 3] = 80 + Math.floor(Math.random() * 90);
    }
    ctx.putImageData(img, 0, 0);

    // text with per-character distortion
    ctx.save();
    ctx.font = "900 28px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace";
    ctx.textBaseline = "middle";
    const x0 = 18;
    const y = h / 2 + 2;
    const spacing = 30;
    for (let i = 0; i < code.length; i += 1) {
      const ch = code[i];
      const x = x0 + i * spacing;
      const rot = (Math.random() - 0.5) * 0.45;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rot);
      ctx.fillStyle = "rgba(10,14,28,0.92)";
      ctx.shadowColor = "rgba(0,0,0,0.35)";
      ctx.shadowBlur = 6;
      ctx.fillText(ch, -8, 0);
      ctx.restore();
    }
    ctx.restore();
  }

  function safeJsonParse(text, fallback) {
    try {
      return JSON.parse(text);
    } catch {
      return fallback;
    }
  }

  function getSettings() {
    const raw = localStorage.getItem(LS.settings);
    const s = safeJsonParse(raw || "{}", {});
    return {
      theme: s.theme === "light" ? "light" : "dark",
      fontSize: Number.isFinite(Number(s.fontSize)) ? Math.min(22, Math.max(12, Number(s.fontSize))) : 14,
      wrap: Boolean(s.wrap),
    };
  }

  function setSettings(next) {
    localStorage.setItem(LS.settings, JSON.stringify(next));
  }

  function applySettings() {
    const s = getSettings();
    document.body.classList.toggle("theme-light", s.theme === "light");
    els.editor.style.fontSize = `${s.fontSize}px`;
    els.editor.style.whiteSpace = s.wrap ? "pre-wrap" : "pre";
    els.editor.style.wordBreak = s.wrap ? "break-word" : "normal";
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function formatDateTime(iso) {
    if (!iso) return "—";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString("uk-UA");
  }

  function caesarShiftChar(ch, shift) {
    if (ch === "-") return "-";
    const idx = CAESAR_ALPHABET.indexOf(ch);
    if (idx === -1) return null;
    const n = CAESAR_ALPHABET.length;
    return CAESAR_ALPHABET[(idx + shift + n) % n];
  }

  function caesarEncrypt(text, shift) {
    const up = String(text || "").toUpperCase();
    let out = "";
    for (const ch of up) {
      const shifted = caesarShiftChar(ch, shift);
      if (shifted === null) return null; // invalid character for our alphabet
      out += shifted;
    }
    return out;
  }

  function isActivated() {
    return localStorage.getItem(LS.activated) === "1";
  }

  function setActivated() {
    localStorage.setItem(LS.activated, "1");
  }

  function ensureInstallAndCountLaunch() {
    if (!localStorage.getItem(LS.installedAt)) {
      localStorage.setItem(LS.installedAt, nowIso());
      localStorage.setItem(LS.launchCount, "0");
    }
    const curr = Number(localStorage.getItem(LS.launchCount) || "0");
    const next = curr + 1;
    localStorage.setItem(LS.launchCount, String(next));
    return next;
  }

  function getInstallInfo() {
    return {
      installedAt: localStorage.getItem(LS.installedAt),
      launchCount: Number(localStorage.getItem(LS.launchCount) || "0"),
    };
  }

  function isBlocked() {
    if (isActivated()) return false;
    const { launchCount } = getInstallInfo();
    return launchCount > TRIAL_MAX_LAUNCHES;
  }

  function updateBadges() {
    const activated = isActivated();
    const { launchCount } = getInstallInfo();

    els.statusBadge.textContent = activated ? "Активовано" : "Trialware";
    els.statusBadge.classList.toggle("badge--muted", !activated);
    els.trialStats.textContent = activated
      ? "Без обмежень"
      : `Запуски: ${launchCount}/${TRIAL_MAX_LAUNCHES} (після цього — блокування)`;
  }

  function updateEditorStats() {
    const text = els.editor.value || "";
    const chars = text.length;
    const lines = text.length === 0 ? 0 : text.split(/\r\n|\r|\n/).length;
    els.editorStats.textContent = `${chars} символів · ${lines} рядків`;
  }

  function setWorkspaceEnabled(enabled) {
    els.workspaceCard.classList.toggle("hidden", !enabled);
    els.blockedCard.classList.toggle("hidden", enabled);
  }

  function downloadText(filename, text, mime = "text/plain;charset=utf-8") {
    const blob = new Blob([text], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function modalOpen(title, bodyHtml, actions = []) {
    els.modalTitle.textContent = title;
    els.modalBody.innerHTML = bodyHtml;
    els.modalActions.innerHTML = "";
    for (const act of actions) {
      const b = document.createElement("button");
      b.type = act.type || "button";
      b.className = act.className || "btn btn--ghost";
      b.textContent = act.label;
      b.addEventListener("click", () => act.onClick?.());
      els.modalActions.appendChild(b);
    }
    if (typeof els.modal.showModal === "function") els.modal.showModal();
  }

  function showHelp() {
    modalOpen(
      "Довідка",
      `
      <div class="muted">
        <p><b>Призначення:</b> навчальний веб‑застосунок із моделлю розповсюдження <b>Trialware</b> та захистом ключа (<b>Шифр Цезаря</b>).</p>
        <p><b>Основні функції (10+):</b></p>
        <ul>
          <li>Відкрити файл</li>
          <li>Зберегти / Зберегти як…</li>
          <li>Друк</li>
          <li>Параметри файлу</li>
          <li>Пошук: знайти наступне / знайти всі</li>
          <li>Заміна: замінити наступне / замінити всі</li>
          <li>Експорт JSON</li>
          <li>Налаштування (тема, розмір шрифту, перенос рядків)</li>
          <li>Про програму</li>
          <li>Активація ключем</li>
        </ul>
        <p><b>Trialware:</b> після <b>${TRIAL_MAX_LAUNCHES}</b> запусків програма блокується, поки не буде введено коректний ключ.</p>
      </div>
      `
    );
  }

  function showAbout() {
    const { installedAt, launchCount } = getInstallInfo();
    modalOpen(
      "Про програму",
      `
      <div class="muted">
        <p><b>Практична робота №3</b> — Методи захисту ПЗ.</p>
        <div class="grid2">
          <div class="kv"><div class="kv__k">Тип ПЗ</div><div class="kv__v">Trialware</div></div>
          <div class="kv"><div class="kv__k">Обмеження</div><div class="kv__v">Блок після 10 запусків</div></div>
        </div>
        <div class="grid2">
          <div class="kv"><div class="kv__k">“Встановлено”</div><div class="kv__v">${formatDateTime(installedAt)}</div></div>
          <div class="kv"><div class="kv__k">Запусків</div><div class="kv__v">${launchCount}</div></div>
        </div>
        <p><b>Шифрування ключа:</b> шифр Цезаря, зсув \(k=${CAESAR_SHIFT}\), алфавіт: <span style="font-family:var(--mono)">${CAESAR_ALPHABET}</span>, дефіс <span style="font-family:var(--mono)">-</span> не шифрується.</p>
      </div>
      `
    );
  }

  function showLicenseInfo() {
    modalOpen(
      "Умови Trialware (варіант)",
      `
      <div class="muted">
        <p>Цей навчальний продукт імітує Trialware‑модель розповсюдження.</p>
        <ul>
          <li>До <b>${TRIAL_MAX_LAUNCHES}</b> запусків — доступні всі функції.</li>
          <li>Після перевищення ліміту — інтерфейс блокується.</li>
          <li>Розблокування — через введення <b>ключа</b>, який перевіряється шляхом <b>шифрування Цезарем</b> та звірення із зашифрованим еталоном.</li>
        </ul>
      </div>
      `
    );
  }

  function promptActivation() {
    let captchaCode = pickCaptchaCode();
    const body = `
      <div class="muted">
        <p>Введіть ключ активації (допустимі символи: <span style="font-family:var(--mono)">${CAESAR_ALPHABET}</span> та дефіс <span style="font-family:var(--mono)">-</span>).</p>
        <label class="field" style="display:block;margin-top:10px">
          <div class="field__label">Ключ</div>
          <input id="activationInput" class="input" type="text" placeholder="Напр.: BPD-LAB-3-OK" />
        </label>

        <div class="divider"></div>
        <p><b>CAPTCHA (Lab 4):</b> введіть символи з зображення.</p>
        <div class="row" style="align-items:flex-end">
          <div style="display:flex;flex-direction:column;gap:6px">
            <canvas id="captchaCanvas" width="230" height="70" style="border-radius:12px;border:1px solid var(--border)"></canvas>
            <button id="captchaRefresh" class="btn btn--ghost" type="button">Оновити CAPTCHA</button>
          </div>
          <div style="flex:1;min-width:220px">
            <label class="field" style="display:block">
              <div class="field__label">CAPTCHA</div>
              <input id="captchaInput" class="input" type="text" placeholder="Введіть 6 символів" autocomplete="off" />
            </label>
          </div>
        </div>

        <div id="activationHint" class="muted" style="margin-top:10px"></div>
      </div>
    `;

    modalOpen("Активація", body, [
      {
        label: "Активувати",
        className: "btn btn--primary",
        onClick: () => {
          const input = document.getElementById("activationInput");
          const hint = document.getElementById("activationHint");
          const captchaInput = document.getElementById("captchaInput");
          const key = (input?.value || "").trim();
          const enc = caesarEncrypt(key, CAESAR_SHIFT);
          const captchaValue = (captchaInput?.value || "").trim().toUpperCase();
          if (!key) {
            hint.textContent = "Введіть ключ.";
            return;
          }
          if (enc === null) {
            hint.textContent = "Ключ містить недопустимі символи для обраного алфавіту.";
            return;
          }
          if (!captchaValue) {
            hint.textContent = "Введіть CAPTCHA.";
            return;
          }
          if (captchaValue !== captchaCode) {
            hint.textContent = "Невірна CAPTCHA. Спробуйте ще раз.";
            captchaCode = pickCaptchaCode();
            drawCaptcha(document.getElementById("captchaCanvas"), captchaCode);
            if (captchaInput) captchaInput.value = "";
            return;
          }
          if (enc !== EXPECTED_KEY_ENC) {
            hint.textContent = "Невірний ключ.";
            return;
          }

          setActivated();
          updateBadges();
          setWorkspaceEnabled(true);
          els.modal.close();
          alert("Активація успішна. Обмеження знято.");
        },
      },
      {
        label: "Показати як шифрується",
        className: "btn btn--ghost",
        onClick: () => {
          const input = document.getElementById("activationInput");
          const hint = document.getElementById("activationHint");
          const key = (input?.value || "").trim();
          const enc = caesarEncrypt(key, CAESAR_SHIFT);
          if (!key) {
            hint.textContent = "Спочатку введіть ключ, щоб показати результат шифрування.";
            return;
          }
          if (enc === null) {
            hint.textContent = "Недопустимі символи: дозволені лише літери A–Z, цифри 0–9 та дефіс '-'.";
            return;
          }
          hint.innerHTML = `Після шифрування Цезарем (k=${CAESAR_SHIFT}) → <span style="font-family:var(--mono)">${enc}</span>`;
        },
      },
    ]);

    setTimeout(() => {
      const input = document.getElementById("activationInput");
      input?.focus();
      const canvas = document.getElementById("captchaCanvas");
      drawCaptcha(canvas, captchaCode);
      document.getElementById("captchaRefresh")?.addEventListener("click", () => {
        captchaCode = pickCaptchaCode();
        drawCaptcha(canvas, captchaCode);
        const ci = document.getElementById("captchaInput");
        if (ci) ci.value = "";
      });
    }, 0);
  }

  // ===== Functions required by lab (10+) =====

  async function openFileFromInput(file) {
    if (!file) return;
    const text = await file.text();
    state.currentFile = {
      name: file.name,
      type: file.type || "text/plain",
      size: file.size,
      lastModified: file.lastModified,
    };
    els.editor.value = text;
    els.fileNameBadge.textContent = file.name;
    updateEditorStats();
    els.searchResult.textContent = "Файл відкрито.";
  }

  function save() {
    const name = state.currentFile?.name || "document.txt";
    downloadText(name, els.editor.value || "", "text/plain;charset=utf-8");
    els.searchResult.textContent = "Файл збережено (завантажено).";
  }

  function saveAs() {
    const suggested = state.currentFile?.name || "document.txt";
    const name = prompt("Назва файлу для збереження:", suggested);
    if (!name) return;
    downloadText(name, els.editor.value || "", "text/plain;charset=utf-8");
    els.searchResult.textContent = `Збережено як: ${name}`;
  }

  function printDoc() {
    const text = els.editor.value || "";
    const w = window.open("", "_blank", "noopener,noreferrer");
    if (!w) {
      alert("Браузер заблокував відкриття вікна для друку.");
      return;
    }
    const safe = text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
    w.document.write(`
      <!doctype html><html><head><meta charset="utf-8" />
      <title>Друк</title>
      <style>
        body{font-family:${getComputedStyle(document.body).fontFamily}; margin:24px;}
        pre{white-space:pre-wrap; word-break:break-word; font-family:${getComputedStyle(els.editor).fontFamily};}
      </style>
      </head><body>
      <h2>${state.currentFile?.name ? state.currentFile.name : "Документ"}</h2>
      <pre>${safe}</pre>
      </body></html>
    `);
    w.document.close();
    w.focus();
    w.print();
    w.close();
  }

  function fileProps() {
    const text = els.editor.value || "";
    const bytes = new Blob([text]).size;
    const lines = text.length === 0 ? 0 : text.split(/\r\n|\r|\n/).length;
    const meta = state.currentFile;

    modalOpen(
      "Параметри файлу",
      `
      <div class="muted">
        <div class="grid2">
          <div class="kv"><div class="kv__k">Ім'я</div><div class="kv__v">${meta?.name || "— (не відкривали файл)"}</div></div>
          <div class="kv"><div class="kv__k">Тип</div><div class="kv__v">${meta?.type || "text/plain"}</div></div>
        </div>
        <div class="grid2">
          <div class="kv"><div class="kv__k">Розмір оригінального файлу</div><div class="kv__v">${meta?.size ?? "—"} байт</div></div>
          <div class="kv"><div class="kv__k">Остання зміна (з файлу)</div><div class="kv__v">${meta?.lastModified ? new Date(meta.lastModified).toLocaleString("uk-UA") : "—"}</div></div>
        </div>
        <div class="grid2">
          <div class="kv"><div class="kv__k">Поточний текст (оцінка)</div><div class="kv__v">${bytes} байт</div></div>
          <div class="kv"><div class="kv__k">Рядків</div><div class="kv__v">${lines}</div></div>
        </div>
      </div>
      `
    );
  }

  function exportJson() {
    const payload = {
      file: state.currentFile,
      content: els.editor.value || "",
      exportedAt: nowIso(),
      trial: {
        model: "Trialware",
        maxLaunches: TRIAL_MAX_LAUNCHES,
        caesar: { shift: CAESAR_SHIFT, alphabet: CAESAR_ALPHABET },
      },
    };
    downloadText("export.json", JSON.stringify(payload, null, 2), "application/json;charset=utf-8");
    els.searchResult.textContent = "Експортовано JSON.";
  }

  function clearEditor() {
    if (!confirm("Очистити редактор?")) return;
    els.editor.value = "";
    state.currentFile = null;
    els.fileNameBadge.textContent = "Немає файлу";
    state.lastFindIndex = 0;
    updateEditorStats();
    els.searchResult.textContent = "Очищено.";
  }

  function findAll() {
    const q = (els.searchQuery.value || "").toString();
    const text = els.editor.value || "";
    if (!q) {
      els.searchResult.textContent = "Введіть рядок для пошуку.";
      return;
    }
    let count = 0;
    let idx = 0;
    while (true) {
      const pos = text.indexOf(q, idx);
      if (pos === -1) break;
      count += 1;
      idx = pos + Math.max(1, q.length);
    }
    els.searchResult.textContent = count ? `Знайдено входжень: ${count}` : "Нічого не знайдено.";
  }

  function findNext() {
    const q = (els.searchQuery.value || "").toString();
    const text = els.editor.value || "";
    if (!q) {
      els.searchResult.textContent = "Введіть рядок для пошуку.";
      return;
    }

    const startFrom = Math.max(els.editor.selectionEnd || 0, state.lastFindIndex || 0);
    let pos = text.indexOf(q, startFrom);
    if (pos === -1 && startFrom > 0) pos = text.indexOf(q, 0);
    if (pos === -1) {
      els.searchResult.textContent = "Нічого не знайдено.";
      return;
    }
    els.editor.focus();
    els.editor.setSelectionRange(pos, pos + q.length);
    state.lastFindIndex = pos + q.length;
    els.searchResult.textContent = `Знайдено: позиція ${pos}`;
  }

  function replaceNext() {
    const q = (els.searchQuery.value || "").toString();
    const r = (els.replaceQuery.value || "").toString();
    const text = els.editor.value || "";
    if (!q) {
      els.searchResult.textContent = "Введіть рядок для пошуку.";
      return;
    }
    const selStart = els.editor.selectionStart || 0;
    const selEnd = els.editor.selectionEnd || 0;
    const selected = text.slice(selStart, selEnd);
    if (selected === q) {
      els.editor.value = text.slice(0, selStart) + r + text.slice(selEnd);
      els.editor.focus();
      els.editor.setSelectionRange(selStart, selStart + r.length);
      state.lastFindIndex = selStart + r.length;
      updateEditorStats();
      els.searchResult.textContent = "Замінено виділене входження.";
      return;
    }
    findNext();
    // if found, selection will match and user can press again; small UX simplification for textarea
  }

  function replaceAll() {
    const q = (els.searchQuery.value || "").toString();
    const r = (els.replaceQuery.value || "").toString();
    if (!q) {
      els.searchResult.textContent = "Введіть рядок для пошуку.";
      return;
    }
    const text = els.editor.value || "";
    const parts = text.split(q);
    if (parts.length === 1) {
      els.searchResult.textContent = "Нічого не знайдено для заміни.";
      return;
    }
    els.editor.value = parts.join(r);
    updateEditorStats();
    els.searchResult.textContent = `Замінено входжень: ${parts.length - 1}`;
  }

  function showSettings() {
    const s = getSettings();
    modalOpen(
      "Налаштування",
      `
      <div class="muted">
        <div class="grid2">
          <div class="kv">
            <div class="kv__k">Тема</div>
            <div class="row" style="margin-top:10px">
              <button id="setThemeDark" class="btn ${s.theme === "dark" ? "btn--primary" : "btn--ghost"}" type="button">Темна</button>
              <button id="setThemeLight" class="btn ${s.theme === "light" ? "btn--primary" : "btn--ghost"}" type="button">Світла</button>
            </div>
          </div>
          <div class="kv">
            <div class="kv__k">Розмір шрифту</div>
            <div class="row" style="margin-top:10px">
              <button id="fontMinus" class="btn btn--ghost" type="button">−</button>
              <span style="font-family:var(--mono);font-weight:900">${s.fontSize}px</span>
              <button id="fontPlus" class="btn btn--ghost" type="button">+</button>
            </div>
          </div>
        </div>
        <div class="kv">
          <div class="kv__k">Перенос рядків</div>
          <div class="row" style="margin-top:10px">
            <button id="wrapOff" class="btn ${!s.wrap ? "btn--primary" : "btn--ghost"}" type="button">Вимк.</button>
            <button id="wrapOn" class="btn ${s.wrap ? "btn--primary" : "btn--ghost"}" type="button">Увімк.</button>
          </div>
        </div>
      </div>
      `
    );

    const apply = (next) => {
      setSettings(next);
      applySettings();
      els.modal.close();
      showSettings();
    };

    document.getElementById("setThemeDark")?.addEventListener("click", () => apply({ ...s, theme: "dark" }));
    document.getElementById("setThemeLight")?.addEventListener("click", () => apply({ ...s, theme: "light" }));
    document.getElementById("fontMinus")?.addEventListener("click", () => apply({ ...s, fontSize: s.fontSize - 1 }));
    document.getElementById("fontPlus")?.addEventListener("click", () => apply({ ...s, fontSize: s.fontSize + 1 }));
    document.getElementById("wrapOff")?.addEventListener("click", () => apply({ ...s, wrap: false }));
    document.getElementById("wrapOn")?.addEventListener("click", () => apply({ ...s, wrap: true }));
  }

  function resetDemo() {
    if (!confirm("Скинути Trialware-лічильник та активацію у цьому браузері?")) return;
    localStorage.removeItem(LS.installedAt);
    localStorage.removeItem(LS.launchCount);
    localStorage.removeItem(LS.activated);
    alert("Скинуто. Перезавантажте сторінку.");
  }

  // ===== Wiring / init =====

  function initTrial() {
    if (!isActivated()) {
      ensureInstallAndCountLaunch();
    } else if (!localStorage.getItem(LS.installedAt)) {
      // if someone activated first, still seed install info for UI
      localStorage.setItem(LS.installedAt, nowIso());
      localStorage.setItem(LS.launchCount, "0");
    }

    const info = getInstallInfo();
    els.installedAt.textContent = formatDateTime(info.installedAt);
    els.launchCount.textContent = String(info.launchCount);
    updateBadges();

    if (isBlocked()) {
      setWorkspaceEnabled(false);
      els.searchResult.textContent = "Доступ заблоковано. Активуйте програму ключем.";
    } else {
      setWorkspaceEnabled(true);
    }
  }

  function initEvents() {
    els.btnHelp.addEventListener("click", showHelp);
    els.btnAbout.addEventListener("click", showAbout);
    els.btnShowLicenseInfo.addEventListener("click", showLicenseInfo);

    els.btnActivate.addEventListener("click", promptActivation);
    els.btnActivateFromBlocked.addEventListener("click", promptActivation);

    els.fileInput.addEventListener("change", (e) => {
      const file = e.target.files?.[0];
      openFileFromInput(file);
      e.target.value = "";
    });

    els.btnSave.addEventListener("click", () => {
      if (isBlocked()) return alert("Функції заблоковано. Активуйте програму.");
      save();
    });
    els.btnSaveAs.addEventListener("click", () => {
      if (isBlocked()) return alert("Функції заблоковано. Активуйте програму.");
      saveAs();
    });
    els.btnPrint.addEventListener("click", () => {
      if (isBlocked()) return alert("Функції заблоковано. Активуйте програму.");
      printDoc();
    });
    els.btnFileProps.addEventListener("click", () => {
      if (isBlocked()) return alert("Функції заблоковано. Активуйте програму.");
      fileProps();
    });
    els.btnExportJson.addEventListener("click", () => {
      if (isBlocked()) return alert("Функції заблоковано. Активуйте програму.");
      exportJson();
    });
    els.btnClear.addEventListener("click", () => {
      if (isBlocked()) return alert("Функції заблоковано. Активуйте програму.");
      clearEditor();
    });
    els.btnSettings.addEventListener("click", showSettings);
    els.btnResetDemo.addEventListener("click", resetDemo);

    els.btnFindNext.addEventListener("click", () => {
      if (isBlocked()) return alert("Функції заблоковано. Активуйте програму.");
      findNext();
    });
    els.btnFindAll.addEventListener("click", () => {
      if (isBlocked()) return alert("Функції заблоковано. Активуйте програму.");
      findAll();
    });
    els.btnReplaceNext.addEventListener("click", () => {
      if (isBlocked()) return alert("Функції заблоковано. Активуйте програму.");
      replaceNext();
    });
    els.btnReplaceAll.addEventListener("click", () => {
      if (isBlocked()) return alert("Функції заблоковано. Активуйте програму.");
      replaceAll();
    });

    els.editor.addEventListener("input", () => {
      updateEditorStats();
    });
  }

  function init() {
    applySettings();
    initTrial();
    initEvents();
    updateEditorStats();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
