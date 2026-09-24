const DEFAULTS = { dotCursor: true, color: "#000000", size: 18, speed: 0.15 };
const $ = (id) => document.getElementById(id);
let state = { ...DEFAULTS };

const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
const toHex = (r, g, b) =>
  "#" + [r, g, b].map((n) => clamp(Math.round(n), 0, 255).toString(16).padStart(2, "0")).join("");
const toRgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

// skip: 今入力中の欄は上書きしない（打ち込み中に値が変わらないように）
function render(skip) {
  const [r, g, b] = toRgb(state.color);
  const values = {
    colorPicker: state.color,
    r, g, b,
    sizeRange: state.size, sizeNum: state.size,
    speedRange: state.speed, speedNum: state.speed,
  };
  for (const id in values) {
    if ($(id) !== skip) $(id).value = values[id];
  }

  // オフのときは色の欄を薄くして、操作できなくする
  $("dotToggle").checked = state.dotCursor;
  for (const id of ["colorPicker", "r", "g", "b"]) {
    $(id).disabled = !state.dotCursor;
  }
  $("colorRow").classList.toggle("disabled", !state.dotCursor);
}

function save() {
  chrome.storage.sync.set(state);
}

$("dotToggle").addEventListener("change", (e) => {
  state.dotCursor = e.target.checked;
  render();
  save();
});

// スライダーと数値入力を連動させる
function bindPair(rangeId, numId, key, min, max) {
  for (const id of [rangeId, numId]) {
    $(id).addEventListener("input", (e) => {
      const v = parseFloat(e.target.value);
      if (Number.isNaN(v)) return;
      state[key] = clamp(v, min, max);
      render(e.target);
      save();
    });
    $(id).addEventListener("change", () => render()); // 範囲外の値を直す
  }
}

bindPair("sizeRange", "sizeNum", "size", 4, 60);
bindPair("speedRange", "speedNum", "speed", 0.01, 1);

$("colorPicker").addEventListener("input", (e) => {
  state.color = e.target.value;
  render(e.target);
  save();
});

for (const id of ["r", "g", "b"]) {
  $(id).addEventListener("input", (e) => {
    const rgb = ["r", "g", "b"].map((k) => parseInt($(k).value, 10));
    if (rgb.some(Number.isNaN)) return;
    state.color = toHex(...rgb);
    render(e.target);
    save();
  });
  $(id).addEventListener("change", () => render());
}

$("reset").addEventListener("click", () => {
  state = { ...DEFAULTS };
  render();
  save();
});

chrome.storage.sync.get(DEFAULTS, (s) => {
  state = { ...DEFAULTS, ...s };
  render();
});