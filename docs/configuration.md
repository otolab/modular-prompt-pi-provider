# 設定

本拡張の設定は **Pi 公式の拡張独自設定パターン** に従う。専用の `pi.registerConfig()` API はない。

参照: [Pi extensions.md — ctx.cwd / CONFIG_DIR_NAME](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/extensions.md)

## 設定ファイルの置き場所

| 優先度 | パス | スコープ |
|---|---|---|
| 1（高） | `.pi/modular-prompt-mlx.yaml` | プロジェクト（**trust 必須**） |
| 2 | `~/.pi/agent/modular-prompt-mlx.yaml` | グローバル |
| 3 | 環境変数（例: `MODULAR_PROMPT_PI_MODEL`） | プロセス |
| 4 | `src/config.ts` デフォルト | コード |

ロードは async factory（`src/index.ts`）起動時に行う。プロジェクトローカルは `ctx.isProjectTrusted()` 相当の判定後にマージする（factory 単体では cwd の存在のみで読むか、`session_start` で再読込するかは実装時に決定）。

```typescript
import { CONFIG_DIR_NAME, getAgentDir } from "@earendil-works/pi-coding-agent";
import { join } from "node:path";

const globalPath = join(getAgentDir(), "modular-prompt-mlx.yaml");
const projectPath = join(process.cwd(), CONFIG_DIR_NAME, "modular-prompt-mlx.yaml");
```

## Pi ネイティブ設定との役割分担

| 関心事 | 設定先 | 本拡張での扱い |
|---|---|---|
| モデル表示名・`contextWindow` 上書き | `~/.pi/agent/models.json` の `modelOverrides` | 読み取り専用連携（discovery #25 と併用可） |
| デフォルトプロバイダ・モデル | `settings.json` の `defaultProvider` / `defaultModel` | Pi 管轄。拡張は `registerProvider` で登録のみ |
| MLX ドライバ・キャッシュ・ログ | `modular-prompt-mlx.yaml` | **本拡張管轄** |

`models.json` に `cacheDir` や `pythonPath` を載せる公式スキーマはない。

## データディレクトリ（ログ・キャッシュ）

Pi の `agentDir` には公式の `logs/` / `cache/` はない。本拡張は **拡張名をトップレベルの名前空間** として使う（設定 YAML と対になる配置）。

| 種別 | グローバル（デフォルト） | プロジェクト |
|---|---|---|
| 設定 | `~/.pi/agent/modular-prompt-mlx.yaml` | `.pi/modular-prompt-mlx.yaml` |
| KV キャッシュ | `~/.pi/agent/modular-prompt-mlx/cache/` | `.pi/modular-prompt-mlx/cache/` |
| リクエストログ | `~/.pi/agent/modular-prompt-mlx/logs/requests/` | `.pi/modular-prompt-mlx/logs/requests/` |

`~/.pi/agent/logs/...` のように Pi 本体の共通ログディレクトリがあるかのようなパスは使わない。

```typescript
import { CONFIG_DIR_NAME, getAgentDir } from "@earendil-works/pi-coding-agent";
import { join } from "node:path";

const globalDataDir = join(getAgentDir(), "modular-prompt-mlx");
const projectDataDir = join(process.cwd(), CONFIG_DIR_NAME, "modular-prompt-mlx");
// cache: join(globalDataDir, "cache")
// logs:  join(globalDataDir, "logs", "requests")
```

会話履歴は Pi 標準の `~/.pi/agent/sessions/` に保存される。本拡張の JSONL は LLM 呼び出しデバッグ用で、セッションファイルとは別。

## 設定ファイル例（案）

```yaml
# ~/.pi/agent/modular-prompt-mlx.yaml または .pi/modular-prompt-mlx.yaml

models:
  - model: mlx-community/gemma-4-26B-A4B-it-heretic-4bit
    provider: mlx
    driverOptions:
      cacheDir: ~/.pi/agent/modular-prompt-mlx/cache
    defaultOptions:
      maxTokens: 8192

drivers:
  mlx:
    pythonPath: ~/.local/share/mise/shims/python3

cache:
  maxAgeDays: 7
  maxSizeGb: 5.0
  minFreeDiskGb: 2.0
  sweepOnStartup: true
  sweepBeforeWrite: true

logging:
  level: info
  requestResponseLevel: full   # none | minimal | full
  dir: ~/.pi/agent/modular-prompt-mlx/logs/requests
```

`~` はロード時に展開する。`cacheDir` / `logging.dir` 未指定時は上記デフォルトを `getAgentDir()` / `CONFIG_DIR_NAME` から組み立てる。

## 意図的に対応しないもの（現時点）

### `~/.modular-prompt-pi/config.yaml`

Pi エコシステム外のパス。本拡張では採用しない。

### `~/.modular-prompt/services.yaml`

`@modular-prompt/driver` 全体向けのサービス定義を将来 modular-prompt 側で導入する可能性がある。**現バージョンでは読み込まない**。導入時は本 YAML との優先順位・マージ方針を別 Issue で設計する。

## `models.json` との二重管理を避ける

| 設定したい内容 | 置き場所 | 本拡張の扱い |
|---|---|---|
| MLX `cacheDir` / `pythonPath` / `defaultOptions` | `modular-prompt-mlx.yaml` | **読み込み・適用** |
| Pi UI の表示名・`contextWindow` | `models.json` `modelOverrides` | 読み取り専用（discovery #25 と併用可） |
| デフォルトモデル選択 | `settings.json` | Pi 管轄。拡張は上書きしない |

`models.json` に `cacheDir` 等を書いても本拡張は参照しない。逆に YAML の `models[].model` は Pi のモデル ID と一致させる（`modelOverrides` のキーと同じ ID）。

## 関連 Issue

- [#41](https://github.com/otolab/modular-prompt-pi-provider/issues/41) — 設定ローダ実装
- [#30](https://github.com/otolab/modular-prompt-pi-provider/issues/30) — `cache` セクション
- [#42](https://github.com/otolab/modular-prompt-pi-provider/issues/42) — `logging` セクション
