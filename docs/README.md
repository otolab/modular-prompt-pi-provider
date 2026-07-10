# ドキュメント索引

`@modular-prompt/pi-provider-ext` の設計・実装ドキュメント。

## 読む順序

| # | 文書 | 内容 |
|---|------|------|
| 1 | [architecture.md](./architecture.md) | 全体構成・責務分担 |
| 2 | [pi-apis.md](./pi-apis.md) | Pi 拡張 API（`streamSimple` 以外のイベント含む） |
| 3 | [modular-prompt-apis.md](./modular-prompt-apis.md) | 消費する `@modular-prompt/driver` API |
| 4 | [adapter.md](./adapter.md) | 型変換・`CompiledPrompt` 組み立て |
| 5 | [streaming.md](./streaming.md) | 生ストリーム → Pi イベント（増分パーサ） |
| 6 | [compaction.md](./compaction.md) | compact・overflow 回復 |
| 7 | [implementation-plan.md](./implementation-plan.md) | ファイル構成・優先度・テスト |
| 8 | [distribution.md](./distribution.md) | 配布・npm・インストール |

## 外部参照

- [Pi custom-provider.md](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/custom-provider.md)
- [Pi extensions.md](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/extensions.md)
- [Pi packages.md](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/packages.md)
- [Pi compaction.md](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/compaction.md)
- [modular-prompt DRIVER_API](https://github.com/otolab/modular-prompt/blob/main/docs/DRIVER_API.md)
- [modular-prompt#291](https://github.com/otolab/modular-prompt/issues/291) — AbortSignal 等ドライバ側課題

## 調査メモ（my-logs）

非公開リポジトリ `my-logs/research/2026.07.pi-agent/` に初期調査あり。
