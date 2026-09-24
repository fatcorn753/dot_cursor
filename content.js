(() => {
  const DEFAULTS = { dotCursor: true, color: "#000000", size: 18, speed: 0.15 };
  let settings = { ...DEFAULTS };

  // ---- メインのカーソル（CSS） ----
  const style = document.createElement("style");
  document.documentElement.appendChild(style);

  function applyCursor() {
    // オフのときはCSSを空にして、通常のカーソルに戻す
    if (!settings.dotCursor) {
      style.textContent = "";
      return;
    }
    const svg =
      `<svg xmlns='http://www.w3.org/2000/svg' width='8' height='8'>` +
      `<circle cx='4' cy='4' r='2' fill='${settings.color}' stroke='white' stroke-width='1'/></svg>`;
    style.textContent =
      `* { cursor: url("data:image/svg+xml,${encodeURIComponent(svg)}") 4 4, auto !important; }`;
  }

  // ---- 追いかけるドット（トップフレームのみ） ----
  let dot = null;

  function applySize() {
    if (!dot) return;
    const s = settings.size;
    dot.style.width = s + "px";
    dot.style.height = s + "px";
    dot.style.margin = `${-s / 2}px 0 0 ${-s / 2}px`;
  }

  function initDot() {
    dot = document.createElement("div");
    dot.style.cssText = `
      position: fixed;
      top: 0; left: 0;
      border-radius: 50%;
      background: white;
      mix-blend-mode: difference;
      pointer-events: none;
      z-index: 2147483647;
      opacity: 0;
    `;
    document.documentElement.appendChild(dot);
    applySize();

    let mx = 0, my = 0;
    let x = 0, y = 0;
    let started = false;
    let last = performance.now();

    addEventListener("mousemove", (e) => {
      mx = e.clientX;
      my = e.clientY;
      if (!started) {
        x = mx; y = my;
        started = true;
        dot.style.opacity = "1";
      }
    }, { passive: true });

    document.addEventListener("mouseleave", () => (dot.style.opacity = "0"));
    document.addEventListener("mouseenter", () => {
      if (started) dot.style.opacity = "1";
    });

    function loop(now) {
      const f = 1 - Math.pow(1 - settings.speed, (now - last) / 16.67);
      last = now;
      x += (mx - x) * f;
      y += (my - y) * f;
      dot.style.transform = `translate(${x}px, ${y}px)`;
      requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);
  }

  // ---- 設定の読み込みと反映 ----
  applyCursor();
  if (window.top === window) initDot();

  chrome.storage.sync.get(DEFAULTS, (s) => {
    settings = { ...DEFAULTS, ...s };
    applyCursor();
    applySize();
  });

  // ポップアップで変更すると、開いているページにすぐ反映される
  chrome.storage.onChanged.addListener((changes) => {
    for (const key in changes) settings[key] = changes[key].newValue;
    applyCursor();
    applySize();
  });
})();