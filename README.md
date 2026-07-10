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
```

Pi は [jiti](https://github.com/unjs/jiti) で TypeScript を直接ロードするため、ビルドは必須ではない。

## 関連

- [modular-prompt](https://github.com/otolab/modular-prompt) — MLX ドライバ本体
- [modular-prompt#291](https://github.com/otolab/modular-prompt/issues/291) — AbortSignal 等ドライバ側課題
- [Pi custom provider](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/custom-provider.md)

## ステータス

🚧 スケルトンのみ。`streamSimple` 実装は未着手。
