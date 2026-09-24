(() => {
  const IS_TOP = window.top === window;
  const TEARDOWN_EVENT = "dot-cursor-teardown";
  const MARK = "data-dot-cursor"; // この拡張機能が作った要素の目印

  // 前に動いていた自分（更新前の版）を止めて、残った要素を片付ける
  document.dispatchEvent(new CustomEvent(TEARDOWN_EVENT));
  document.querySelectorAll(`[${MARK}]`).forEach((el) => el.remove());

  const abort = new AbortController();
  const { signal } = abort; // これを渡したリスナーは、まとめて解除できる

  // 拡大の対象：クリックすると何かが起きる要素 / テキスト入力欄
  const CLICKABLE = [
    "a[href]", "button", "summary", "select", "label",
    '[role="button"]', '[role="link"]', "[onclick]",
    'input[type="button"]', 'input[type="submit"]',
    'input[type="checkbox"]', 'input[type="radio"]',
  ].join(",");
  const INPUTS = "input, textarea, [contenteditable]";

  let settings = { ...DEFAULTS };
  let hoverSelector = CLICKABLE;
  let hovering = false; // 今、対象の要素の上にいるか

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

  // ---- 追いかけるドット ----
  function createFollower() {
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

    let targetX = 0, targetY = 0; // マウスの位置
    let x = 0, y = 0;             // ドットの位置
    let positioned = false;       // 一度でもマウスが動いたか
    let running = false;          // アニメーション中か
    let destroyed = false;
    let lastTime = 0;

    const place = () => (el.style.translate = `${x}px ${y}px`);

    function tick(now) {
      if (destroyed) return;

      // フレームレートが違っても同じ速さに見えるよう補正
      const dt = lastTime ? now - lastTime : 16.67;
      lastTime = now;
      const f = 1 - Math.pow(1 - settings.speed, dt / 16.67);
      x += (targetX - x) * f;
      y += (targetY - y) * f;

      // 追いついたら止める（止まっている間は計算しない）
      const settled = Math.abs(targetX - x) < 0.1 && Math.abs(targetY - y) < 0.1;
      if (settled) {
        x = targetX;
        y = targetY;
      }
      place();

      if (settled) {
        running = false;
        lastTime = 0;
      } else {
        requestAnimationFrame(tick);
      }
    }

    return {
      moveTo(px, py) {
        targetX = px;
        targetY = py;
        if (!positioned) {
          positioned = true;
          x = px;
          y = py;
          place();
          el.style.opacity = "1";
        }
        if (!running) {
          running = true;
          requestAnimationFrame(tick);
        }
      },
      show() { if (positioned) el.style.opacity = "1"; },
      hide() { el.style.opacity = "0"; },
      setScale(n) { el.style.scale = String(n); },
      setSize(s) {
        el.style.width = el.style.height = `${s}px`;
        el.style.margin = `${-s / 2}px 0 0 ${-s / 2}px`;
      },
      destroy() {
        destroyed = true;
        el.remove();
      },
    };
  }

  const follower = IS_TOP ? createFollower() : null;

  const updateScale = () =>
    follower.setScale(settings.hoverEnabled && hovering ? settings.hoverScale : 1);

  if (follower) {
    addEventListener("mousemove", (e) => follower.moveTo(e.clientX, e.clientY), { passive: true, signal });

    // リンクやボタンの上に乗ったら大きくする
    document.addEventListener("mouseover", (e) => {
      // Shadow DOM の中でも、実際に指している一番内側の要素を使う
      const target = e.composedPath()[0];
      hovering = !!target?.closest?.(hoverSelector);
      updateScale();
    }, { passive: true, signal });

    document.addEventListener("mouseleave", () => {
      hovering = false;
      updateScale();
      follower.hide();
    }, { signal });
    document.addEventListener("mouseenter", () => follower.show(), { signal });
  }

  // ---- 設定の反映（変わった項目に関係する処理だけ実行） ----
  function applySettings(changes = null) {
    const changed = (keys) => !changes || keys.some((k) => k in changes);

    if (changed(["dotCursor", "color", "mainSize"])) applyCursor();
    if (changed(["hoverInputs"])) {
      hoverSelector = settings.hoverInputs ? `${CLICKABLE}, ${INPUTS}` : CLICKABLE;
    }
    if (follower) {
      if (changed(["size"])) follower.setSize(settings.size);
      if (changed(["hoverEnabled", "hoverScale"])) updateScale();
    }
  }

  // ポップアップで変更すると、開いているページにすぐ反映される
  function onStorageChanged(changes, area) {
    if (area !== "local") return;
    for (const [key, { newValue }] of Object.entries(changes)) settings[key] = newValue;
    applySettings(changes);
  }

  applySettings(); // 保存値を読むまでの間は、デフォルトで表示する
  chrome.storage.local.get(DEFAULTS, (saved) => {
    settings = saved;
    applySettings();
  });
  chrome.storage.onChanged.addListener(onStorageChanged);

  // ---- 片付け（拡張機能が更新されて、新しい版が来たとき） ----
  document.addEventListener(TEARDOWN_EVENT, () => {
    abort.abort(); // このファイルで付けたリスナーを全部解除
    follower?.destroy();
    cursorStyle.remove();
    try {
      chrome.storage.onChanged.removeListener(onStorageChanged);
    } catch {} // 更新後は chrome.* に触れなくなっていることがある
  }, { once: true, signal });
})();