// 設定のデフォルト値（content.js と popup.js で共有）
// 二重に注入されても宣言エラーにならないよう、var にしている
var DEFAULTS = {
  dotCursor: true,     // メインのカーソルをドットにする
  color: "#000000",    // メインのドットの色
  mainSize: 8,         // メインのドットの大きさ(px)
  size: 18,            // 追いかけるドットの大きさ(px)
  speed: 0.15,         // 追いかける速さ（大きいほど速い）
  hoverEnabled: true,  // リンクなどの上で追いかけるドットを大きくする
  hoverScale: 2,       // そのときの倍率
  hoverInputs: false,  // テキスト入力欄も対象にする
};