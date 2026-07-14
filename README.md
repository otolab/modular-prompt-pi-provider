# @modular-prompt/pi-provider-ext

[Pi](https://github.com/earendil-works/pi) 向け **プラグイン**（`pi install` で入る拡張）。[`@modular-prompt/driver`](https://github.com/otolab/modular-prompt) を Pi のカスタム LLM プロバイダ **`modular-prompt-provider`** として登録する。

modular-prompt はプロンプトフレームワーク本体、本リポジトリはその driver 層を Pi に載せるアダプタ。関係の詳細は [docs/configuration.md](./docs/configuration.md#modular-promptpi本プラグインの関係)。

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
npm run test:run          # ユニットテスト（MLX 非起動・逐次実行）
npm run test:integration  # MLX 実機インテグレーション（未導入・非対応時は skip）
npm run test:all          # 両方
```

インテグレーションのデフォルトモデルは [`prism-ml/Ternary-Bonsai-1.7B-mlx-2bit`](https://huggingface.co/prism-ml/Ternary-Bonsai-1.7B-mlx-2bit)（text LM・KV キャッシュ対応）。`INTEGRATION_MLX_MODEL` で上書き可能。詳細は [implementation-plan.md](./docs/implementation-plan.md#テスト)。

```bash
export INTEGRATION_MLX_MODEL=prism-ml/Ternary-Bonsai-1.7B-mlx-2bit
npm run test:integration
```

Pi は [jiti](https://github.com/unjs/jiti) で TypeScript を直接ロードするため、ビルドは必須ではない。

### モデル・設定

優先度: `.pi/modular-prompt-provider/config.yaml`（trust 後）> `~/.pi/agent/modular-prompt-provider/config.yaml` > `MODULAR_PROMPT_PI_MODEL` > コードデフォルト。

```bash
mkdir -p ~/.pi/agent/modular-prompt-provider
cp modular-prompt-provider/config.yaml.example ~/.pi/agent/modular-prompt-provider/config.yaml
# または
export MODULAR_PROMPT_PI_MODEL=mlx-community/gemma-4-26B-A4B-it-heretic-4bit
```

詳細: [docs/configuration.md](./docs/configuration.md)

## ドキュメント

詳細は [docs/](./docs/) を参照。まず [scope.md](./docs/scope.md)。

| 文書 | 内容 |
|------|------|
| [scope](./docs/scope.md) | 実装スコープ（driver 要求 / 本リポジトリ） |
| [architecture](./docs/architecture.md) | 全体構成・責務分担 |
| [configuration](./docs/configuration.md) | プラグイン設定・modular-prompt との関係 |
| [pi-apis](./docs/pi-apis.md) | Pi 拡張 API（イベント含む） |
| [modular-prompt-apis](./docs/modular-prompt-apis.md) | driver 消費 API |
| [adapter](./docs/adapter.md) | 型変換 |
| [streaming](./docs/streaming.md) | 増分パーサ |
| [abort-spec](./docs/abort-spec.md) | AbortSignal 要求仕様 |
| [compaction](./docs/compaction.md) | compact・overflow |
| [implementation-plan](./docs/implementation-plan.md) | ファイル構成・テスト |
| [distribution](./docs/distribution.md) | 配布・npm |

## 関連

- [modular-prompt](https://github.com/otolab/modular-prompt) — プロンプトフレームワーク本体（本プラグインはその `driver` パッケージを利用。**driver 0.14.0+** 必須）
- [modular-prompt#291](https://github.com/otolab/modular-prompt/issues/291) — driver 側対応（完了）
- [Pi custom provider](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/custom-provider.md)

## ステータス

🚧 **M1 検証残** — P0 コード・ユニットテスト完了。`pi install` 実機確認と Pi 公式テストが残り（[scope](./docs/scope.md) / [implementation-plan](./docs/implementation-plan.md)）。
