const $ = (id) => document.getElementById(id);
const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
const toHex = (r, g, b) =>
  "#" + [r, g, b].map((n) => clamp(Math.round(n), 0, 255).toString(16).padStart(2, "0")).join("");
const toRgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

let state = normalize();
const cards = new Map(); // ドットのid -> カードの要素

const save = (patch) => chrome.storage.local.set(patch);

// ---- 描画 ----
// activeInput: 今入力中の欄（打ち込み中に値を書き換えないため、反映から除く）
function render(activeInput) {
  renderMain(activeInput);
  renderFollowers(activeInput);
}

function renderMain(activeInput) {
  const [r, g, b] = toRgb(state.color);
  const values = {
    color: state.color, r, g, b,
    mainSize: state.mainSize, mainSizeNum: state.mainSize,
  };
  for (const [id, value] of Object.entries(values)) {
    if ($(id) !== activeInput) $(id).value = value;
  }
  $("dotCursor").checked = state.dotCursor;
  $("dotBox").disabled = !state.dotCursor; // オフのときは薄くして操作できなくする
}

function renderFollowers(activeInput) {
  const ids = new Set(state.followers.map((f) => f.id));

  // 消えたドットのカードを取り除く
  for (const [id, card] of cards) {
    if (!ids.has(id)) {
      card.remove();
      cards.delete(id);
    }
  }
  // 新しいドットのカードを作り、全カードの値を反映する
  for (const f of state.followers) {
    let card = cards.get(f.id);
    if (!card) {
      card = createCard(f.id);
      cards.set(f.id, card);
      $("followerList").appendChild(card);
    }
    syncCard(card, f, activeInput);
  }
  $("emptyHint").hidden = state.followers.length > 0;
}

function syncCard(card, f, activeInput) {
  const name = card.querySelector(".name");
  if (name !== activeInput) name.value = f.name;

  for (const input of card.querySelectorAll("[data-key]")) {
    if (input === activeInput) continue;
    const value = f[input.dataset.key];
    if (input.type === "checkbox") input.checked = value;
    else input.value = value;
  }
  card.querySelector(".hover-box").disabled = !f.hoverEnabled;
}

// ---- 更新 ----
function update(patch, activeInput) {
  Object.assign(state, patch);
  save(patch);
  render(activeInput);
}

function updateFollower(id, patch, activeInput) {
  const followers = state.followers.map((f) => (f.id === id ? { ...f, ...patch } : f));
  update({ followers }, activeInput);
}

// ---- メインのドットの入力 ----
$("dotCursor").addEventListener("change", (e) => update({ dotCursor: e.target.checked }));
$("color").addEventListener("input", (e) => update({ color: e.target.value }, e.target));

for (const id of ["r", "g", "b"]) {
  $(id).addEventListener("input", (e) => {
    const rgb = ["r", "g", "b"].map((k) => parseInt($(k).value, 10));
    if (!rgb.some(Number.isNaN)) update({ color: toHex(...rgb) }, e.target);
  });
  $(id).addEventListener("change", () => render());
}

// スライダーと数値入力を連動させる（範囲はHTMLの min / max から読む）
for (const input of [$("mainSize"), $("mainSizeNum")]) {
  const min = Number(input.min);
  const max = Number(input.max);
  input.addEventListener("input", () => {
    const value = parseFloat(input.value);
    if (!Number.isNaN(value)) update({ mainSize: clamp(value, min, max) }, input);
  });
  input.addEventListener("change", () => render()); // 範囲外の入力を直す
}

// ---- 追いかけるドットのカード ----
function createCard(id) {
  const card = $("followerTemplate").content.firstElementChild.cloneNode(true);

  card.querySelector(".fold").addEventListener("click", () => card.classList.toggle("collapsed"));

  const name = card.querySelector(".name");
  name.addEventListener("input", () => updateFollower(id, { name: name.value }, name));

  card.querySelector(".del").addEventListener("click", () => {
    const target = state.followers.find((f) => f.id === id);
    if (!confirm(`「${target?.name || "名前なし"}」を削除しますか？`)) return;
    update({ followers: state.followers.filter((f) => f.id !== id) });
  });

  for (const input of card.querySelectorAll("[data-key]")) {
    const key = input.dataset.key;
    if (input.type === "checkbox") {
      input.addEventListener("change", () => updateFollower(id, { [key]: input.checked }));
    } else {
      const min = Number(input.min);
      const max = Number(input.max);
      input.addEventListener("input", () => {
        const value = parseFloat(input.value);
        if (!Number.isNaN(value)) updateFollower(id, { [key]: clamp(value, min, max) }, input);
      });
      input.addEventListener("change", () => render());
    }
  }
  return card;
}

$("addFollower").addEventListener("click", () => {
  // 名前は「ドット N」の、まだ使っていない番号にする
  const names = new Set(state.followers.map((f) => f.name));
  let n = state.followers.length + 1;
  while (names.has(`ドット ${n}`)) n++;

  // 直前のドットと完全に重ならないよう、少しゆっくりにしておく
  const last = state.followers.at(-1) ?? FOLLOWER_DEFAULTS;
  const speed = Math.max(0.02, +(last.speed * 0.6).toFixed(2));

  const added = { ...FOLLOWER_DEFAULTS, id: newFollowerId(), name: `ドット ${n}`, speed };
  update({ followers: [...state.followers, added] });
  cards.get(added.id).scrollIntoView({ block: "nearest" });
});

$("reset").addEventListener("click", () => {
  if (!confirm("すべての設定をデフォルトに戻します。追加したドットも削除されます。")) return;
  state = normalize();
  save(state);
  render();
});

chrome.storage.local.get(null, (raw) => {
  state = normalize(raw);
  render();
});