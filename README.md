# @modular-prompt/pi-provider-ext

[Pi](https://github.com/earendil-works/pi) 向け Pi パッケージ。`@modular-prompt/driver` の MLX ドライバをカスタム LLM プロバイダとして登録する。

## パッケージ名について

npm 名は **`@modular-prompt/pi-provider-ext`**（リポジトリ名 `modular-prompt-pi-provider` と分離）。

| 候補 | 例 | 特徴 |
|------|-----|------|
| `@modular-prompt/pi-*` | `pi-provider-ext`, `pi-mlx-provider` | driver / core と同スコープで系列がわかりやすい |
| `pi-<機能>`（無スコープ） | `pi-web-access`, `pi-subagents`, `pi-mcp-adapter` | コミュニティで最も多い。ギャラリー検索向き |
| `@<org>/pi-<機能>` | `@plannotator/pi-extension`, `@gotgenes/pi-permission-system` | 組織スコープ + `pi-` プレフィックス |

`-ext` は「Pi extension」であることを示す。短くするなら `@modular-prompt/pi-mlx-provider` も可。

## インストール（開発中）

```bash
# ローカルパス
pi install /path/to/modular-prompt-pi-provider

# git（公開後）
pi install git:github.com/otolab/modular-prompt-pi-provider@main

# npm（publish 後）
pi install npm:@modular-prompt/pi-provider-ext
```

プロジェクト共有:

```bash
pi install -l git:github.com/otolab/modular-prompt-pi-provider@main
```

## 開発

```bash
npm install
npm run typecheck
npm run test:run   # ユニットテスト（MLX 非起動・逐次実行）
```

Pi は [jiti](https://github.com/unjs/jiti) で TypeScript を直接ロードするため、ビルドは必須ではない。

### モデル差し替え（開発時）

```bash
export MODULAR_PROMPT_PI_MODEL=mlx-community/gemma-4-26B-A4B-it-heretic-4bit
```

デフォルトは上記モデル。`src/config.ts` の `ApplicationConfig.models` で複数登録も可能。

## ドキュメント

詳細は [docs/](./docs/) を参照。まず [scope.md](./docs/scope.md)。

| 文書 | 内容 |
|------|------|
| [scope](./docs/scope.md) | 実装スコープ（driver 要求 / 本リポジトリ） |
| [architecture](./docs/architecture.md) | 全体構成・責務分担 |
| [pi-apis](./docs/pi-apis.md) | Pi 拡張 API（イベント含む） |
| [modular-prompt-apis](./docs/modular-prompt-apis.md) | driver 消費 API |
| [adapter](./docs/adapter.md) | 型変換 |
| [streaming](./docs/streaming.md) | 増分パーサ |
| [abort-spec](./docs/abort-spec.md) | AbortSignal 要求仕様 |
| [compaction](./docs/compaction.md) | compact・overflow |
| [implementation-plan](./docs/implementation-plan.md) | ファイル構成・テスト |
| [distribution](./docs/distribution.md) | 配布・npm |

## 関連

- [modular-prompt](https://github.com/otolab/modular-prompt) — MLX ドライバ本体（**driver 0.14.0+** 必須）
- [modular-prompt#291](https://github.com/otolab/modular-prompt/issues/291) — driver 側対応（完了）
- [Pi custom provider](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/custom-provider.md)

## ステータス

🚧 **M1 検証残** — P0 コード・ユニットテスト完了。`pi install` 実機確認と Pi 公式テストが残り（[scope](./docs/scope.md) / [implementation-plan](./docs/implementation-plan.md)）。
