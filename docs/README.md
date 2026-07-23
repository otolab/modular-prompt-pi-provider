# ドキュメント索引

`@modular-prompt/pi-provider-ext` の設計・実装ドキュメント。

## 読む順序

| # | 文書 | 内容 |
|---|------|------|
| 1 | [scope.md](./scope.md) | 実装スコープ（driver 要求 / 本リポジトリ範囲） |
| 2 | [architecture.md](./architecture.md) | 全体構成・責務分担 |
| 3 | [pi-apis.md](./pi-apis.md) | Pi 拡張 API（`streamSimple` 以外のイベント含む） |
| 4 | [configuration.md](./configuration.md) | 設定ファイル配置・Pi 設定との役割分担 |
| 5 | [modular-prompt-apis.md](./modular-prompt-apis.md) | 消費する `@modular-prompt/driver` API |
| 5b | [modular-prompt-structure.md](./modular-prompt-structure.md) | modular-prompt 全体構造（core / process / compact 向け） |
| 6 | [adapter.md](./adapter.md) | 型変換・`CompiledPrompt` 組み立て |
| 7 | [streaming.md](./streaming.md) | 生ストリーム → Pi イベント（増分パーサ） |
| 8 | [abort-spec.md](./abort-spec.md) | AbortSignal 要求仕様 |
| 9 | [compaction.md](./compaction.md) | compact・overflow 回復 |
| 10 | [logging.md](./logging.md) | JSONL デバッグログ・extract-log |
| 11 | [implementation-plan.md](./implementation-plan.md) | ファイル構成・テスト |
| 12 | [distribution.md](./distribution.md) | 配布・npm・インストール |

## 外部参照

- [Pi custom-provider.md](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/custom-provider.md)
- [Pi extensions.md](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/extensions.md)
- [Pi packages.md](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/packages.md)
- [Pi compaction.md](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/compaction.md)
- [modular-prompt DRIVER_API](https://github.com/otolab/modular-prompt/blob/main/docs/DRIVER_API.md)
- [modular-prompt#291](https://github.com/otolab/modular-prompt/issues/291) — driver 0.14.0 で対応済み（signal / usage）

## 調査メモ（my-logs）

非公開リポジトリ `my-logs/research/2026.07.pi-agent/` に初期調査あり。
