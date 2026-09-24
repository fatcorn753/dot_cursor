(() => {
  const IS_TOP = window.top === window;
  const TEARDOWN_EVENT = "dot-cursor-teardown";
  const MARK = "data-dot-cursor"; // この拡張機能が作った要素の目印

  // 前に動いていた自分（更新前の版）を止めて、残った要素を片付ける
  document.dispatchEvent(new CustomEvent(TEARDOWN_EVENT));
  document.querySelectorAll(`[${MARK}]`).forEach((el) => el.remove());

  const abort = new AbortController();
  const { signal } = abort; // これを渡したリスナーは、まとめて解除できる
  let destroyed = false;

  // 拡大の対象：クリックすると何かが起きる要素 / それ + テキスト入力欄
  const CLICKABLE = [
    "a[href]", "button", "summary", "select", "label",
    '[role="button"]', '[role="link"]', "[onclick]",
    'input[type="button"]', 'input[type="submit"]',
    'input[type="checkbox"]', 'input[type="radio"]',
  ].join(",");
  const CLICKABLE_AND_INPUTS = `${CLICKABLE}, input, textarea, [contenteditable]`;

  let settings = normalize();
  let hoverTarget = null; // マウスが今乗っている要素

  // ---- メインのカーソル（CSS） ----
  const cursorStyle = document.createElement("style");
  cursorStyle.setAttribute(MARK, "");
  document.documentElement.appendChild(cursorStyle);

  function applyCursor() {
    // オフのときはCSSを空にして、通常のカーソルに戻す
    if (!settings.dotCursor) {
      cursorStyle.textContent = "";
      return;
    }
    const s = settings.mainSize;
    const c = s / 2; // 中心
    const svg =
      `<svg xmlns='http://www.w3.org/2000/svg' width='${s}' height='${s}'>` +
      `<circle cx='${c}' cy='${c}' r='${s * 0.25}' fill='${settings.color}' ` +
      `stroke='white' stroke-width='${Math.max(1, s / 8)}'/></svg>`;
    const hotspot = Math.round(c);
    cursorStyle.textContent =
      `* { cursor: url("data:image/svg+xml,${encodeURIComponent(svg)}") ` +
      `${hotspot} ${hotspot}, auto !important; }`;
  }

  // ---- 追いかけるドット（複数） ----
  const followers = new Map(); // id -> follower
  const mouse = { x: 0, y: 0, moved: false, inside: true };

  function createFollower(cfg) {
    const el = document.createElement("div");
    el.setAttribute(MARK, "");
    // 位置は translate、拡大は scale で指定する。
    // （transform で位置を指定すると、scale の影響を受けて位置がずれる）
    el.style.cssText = `
      position: fixed;
      top: 0; left: 0;
      border-radius: 50%;
      background: white;
      mix-blend-mode: difference;
      pointer-events: none;
      z-index: 2147483647;
      opacity: 0;
      scale: 1;
      transition: scale 0.15s ease-out;
      will-change: translate;
    `;
    document.documentElement.appendChild(el);

    const f = {
      el,
      cfg,
      x: mouse.x,
      y: mouse.y,

      place() {
        el.style.translate = `${f.x}px ${f.y}px`;
      },
      snapToMouse() {
        f.x = mouse.x;
        f.y = mouse.y;
        f.place();
      },
      // 1フレーム進める。まだ追いついていなければ true を返す
      step(dt) {
        // フレームレートが違っても同じ速さに見えるよう補正
        const k = 1 - Math.pow(1 - f.cfg.speed, dt / 16.67);
        f.x += (mouse.x - f.x) * k;
        f.y += (mouse.y - f.y) * k;
        const settled = Math.abs(mouse.x - f.x) < 0.1 && Math.abs(mouse.y - f.y) < 0.1;
        if (settled) {
          f.x = mouse.x;
          f.y = mouse.y;
        }
        f.place();
        return !settled;
      },
      updateScale() {
        const { hoverEnabled, hoverScale, hoverInputs } = f.cfg;
        const selector = hoverInputs ? CLICKABLE_AND_INPUTS : CLICKABLE;
        const hit = hoverEnabled && hoverTarget?.closest?.(selector);
        el.style.scale = hit ? String(hoverScale) : "1";
      },
      update(next) {
        f.cfg = next;
        const s = next.size;
        el.style.width = el.style.height = `${s}px`;
        el.style.margin = `${-s / 2}px 0 0 ${-s / 2}px`;
        f.updateScale();
      },
      destroy() {
        el.remove();
      },
    };

    f.update(cfg);
    if (mouse.moved) f.snapToMouse();
    return f;
  }

  // 全ドットを1つのループで動かす。全部追いついたら止める
  let running = false;
  let lastTime = 0;

  function tick(now) {
    if (destroyed) return;
    const dt = lastTime ? now - lastTime : 16.67;
    lastTime = now;

    let busy = false;
    for (const f of followers.values()) busy = f.step(dt) || busy;

    if (busy) {
      requestAnimationFrame(tick);
    } else {
      running = false;
      lastTime = 0;
    }
  }

  function startLoop() {
    if (running || followers.size === 0) return;
    running = true;
    requestAnimationFrame(tick);
  }

  function updateVisibility() {
    const opacity = mouse.moved && mouse.inside ? "1" : "0";
    for (const f of followers.values()) f.el.style.opacity = opacity;
  }

  const updateScales = () => followers.forEach((f) => f.updateScale());

  // 設定のドット一覧に合わせて、作る・更新する・消す
  function syncFollowers() {
    const ids = new Set(settings.followers.map((cfg) => cfg.id));
    for (const [id, f] of followers) {
      if (!ids.has(id)) {
        f.destroy();
        followers.delete(id);
      }
    }
    for (const cfg of settings.followers) {
      const f = followers.get(cfg.id);
      if (f) f.update(cfg);
      else followers.set(cfg.id, createFollower(cfg));
    }
    updateVisibility();
    startLoop();
  }

  if (IS_TOP) {
    addEventListener("mousemove", (e) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
      if (!mouse.moved) {
        mouse.moved = true;
        followers.forEach((f) => f.snapToMouse());
        updateVisibility();
      }
      startLoop();
    }, { passive: true, signal });

    // リンクやボタンの上に乗ったら大きくする
    document.addEventListener("mouseover", (e) => {
      // Shadow DOM の中でも、実際に指している一番内側の要素を使う
      hoverTarget = e.composedPath()[0];
      updateScales();
    }, { passive: true, signal });

    document.addEventListener("mouseleave", () => {
      mouse.inside = false;
      hoverTarget = null;
      updateScales();
      updateVisibility();
    }, { signal });

    document.addEventListener("mouseenter", () => {
      mouse.inside = true;
      updateVisibility();
    }, { signal });
  }

  // ---- 設定の反映 ----
  function applySettings(prev) {
    const cursorChanged = ["dotCursor", "color", "mainSize"].some(
      (key) => !prev || prev[key] !== settings[key]
    );
    if (cursorChanged) applyCursor();
    if (IS_TOP) syncFollowers();
  }

  function loadSettings() {
    chrome.storage.local.get(null, (raw) => {
      if (destroyed) return;
      const prev = settings;
      settings = normalize(raw);
      applySettings(prev);
    });
  }

  // ポップアップで変更すると、開いているページにすぐ反映される
  function onStorageChanged(_changes, area) {
    if (area === "local") loadSettings();
  }

  chrome.storage.onChanged.addListener(onStorageChanged);
  loadSettings();
  applySettings(null); // 保存値を読むまでの間は、デフォルトで表示する

  // ---- 片付け（拡張機能が更新されて、新しい版が来たとき） ----
  document.addEventListener(TEARDOWN_EVENT, () => {
    destroyed = true;
    abort.abort(); // このファイルで付けたリスナーを全部解除
    followers.forEach((f) => f.destroy());
    followers.clear();
    cursorStyle.remove();
    try {
      chrome.storage.onChanged.removeListener(onStorageChanged);
    } catch {} // 更新後は chrome.* に触れなくなっていることがある
  }, { once: true, signal });
})();