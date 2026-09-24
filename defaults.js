// 設定のデフォルト値と、保存データの整形（content.js と popup.js で共有）
// 二重に注入されても宣言エラーにならないよう、const ではなく var / function を使う

// メインのドット（全体で1つ）
var GLOBAL_DEFAULTS = {
  dotCursor: true,   // メインのカーソルをドットにする
  color: "#000000",  // メインのドットの色
  mainSize: 8,       // メインのドットの大きさ(px)
};

// 追いかけるドット（1つぶんの設定。複数持てる）
var FOLLOWER_DEFAULTS = {
  size: 18,            // 大きさ(px)
  speed: 0.15,         // 追いかける速さ（大きいほど速い）
  hoverEnabled: true,  // リンクなどの上で大きくする
  hoverScale: 2,       // そのときの倍率
  hoverInputs: false,  // テキスト入力欄も対象にする
};

function newFollowerId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

// 保存データ（chrome.storage.local.get(null) の結果）を、使える形に整える
function normalize(raw = {}) {
  const settings = {};
  for (const key in GLOBAL_DEFAULTS) settings[key] = raw[key] ?? GLOBAL_DEFAULTS[key];

  let list = raw.followers;
  if (!Array.isArray(list)) {
    // 旧バージョン（追いかけるドットが1つだけ）の設定を引き継ぐ
    const legacy = {};
    for (const key in FOLLOWER_DEFAULTS) if (key in raw) legacy[key] = raw[key];
    list = [{ id: "default", ...legacy }];
  }

  settings.followers = list.map((f, i) => ({
    ...FOLLOWER_DEFAULTS,
    ...f,
    id: f.id ?? newFollowerId(),
    name: f.name ?? `ドット ${i + 1}`,
  }));
  return settings;
}