const $ = (id) => document.getElementById(id);
const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
const toHex = (r, g, b) =>
  "#" + [r, g, b].map((n) => clamp(Math.round(n), 0, 255).toString(16).padStart(2, "0")).join("");
const toRgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

const TOGGLES = ["dotCursor", "hoverEnabled", "hoverInputs"]; // チェックボックス
const SLIDERS = ["mainSize", "size", "speed", "hoverScale"];  // スライダー + 数値入力

let state = { ...DEFAULTS };

// 設定を更新して、保存し、画面に反映する
// activeInput: 今入力中の欄（打ち込み中に値を書き換えないため、反映から除く）
function update(patch, activeInput) {
  Object.assign(state, patch);
  chrome.storage.local.set(patch);
  render(activeInput);
}

function render(activeInput) {
  const [r, g, b] = toRgb(state.color);
  const values = { color: state.color, r, g, b };
  for (const key of SLIDERS) values[key] = values[`${key}Num`] = state[key];

  for (const [id, value] of Object.entries(values)) {
    if ($(id) !== activeInput) $(id).value = value;
  }
  for (const key of TOGGLES) $(key).checked = state[key];

  // オフのときは、関連する設定を薄くして操作できなくする
  $("dotBox").disabled = !state.dotCursor;
  $("hoverBox").disabled = !state.hoverEnabled;
}

// ---- チェックボックス ----
for (const key of TOGGLES) {
  $(key).addEventListener("change", (e) => update({ [key]: e.target.checked }));
}

// ---- スライダーと数値入力（範囲はHTMLの min / max から読む） ----
for (const key of SLIDERS) {
  const range = $(key);
  const min = Number(range.min);
  const max = Number(range.max);

  for (const input of [range, $(`${key}Num`)]) {
    input.addEventListener("input", () => {
      const value = parseFloat(input.value);
      if (!Number.isNaN(value)) update({ [key]: clamp(value, min, max) }, input);
    });
    input.addEventListener("change", () => render()); // 範囲外の入力を直す
  }
}

// ---- 色（パレットとRGB入力を連動） ----
$("color").addEventListener("input", (e) => update({ color: e.target.value }, e.target));

for (const id of ["r", "g", "b"]) {
  $(id).addEventListener("input", (e) => {
    const rgb = ["r", "g", "b"].map((k) => parseInt($(k).value, 10));
    if (!rgb.some(Number.isNaN)) update({ color: toHex(...rgb) }, e.target);
  });
  $(id).addEventListener("change", () => render());
}

$("reset").addEventListener("click", () => update({ ...DEFAULTS }));

chrome.storage.local.get(DEFAULTS, (saved) => {
  state = saved;
  render();
});