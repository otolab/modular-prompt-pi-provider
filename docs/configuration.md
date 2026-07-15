# 設定

## modular-prompt・Pi・本プラグインの関係

このリポジトリは **Pi プラグイン**（`pi install` で入る拡張）である。modular-prompt フレームワーク本体ではない。

| 名前 | 何か | Pi との関係 |
|---|---|---|
| **[modular-prompt](https://github.com/otolab/modular-prompt)** | プロンプトをモジュールとして組み立てる TypeScript フレームワーク。`core` / `driver` / `process` 等のモノレポ | **Pi 非依存**。CLI・アプリ・他エディタからも使える |
| **Pi** | コーディングエージェント（`pi-coding-agent`）。ツール実行・セッション・組み込み compact を持つ | プラグインを読み込み、`registerProvider` で LLM プロバイダを差し替え可能 |
| **modular-prompt-provider**（本プラグイン） | `@modular-prompt/driver` の `AIService` を Pi のカスタム LLM プロバイダとして登録するアダプタ | `pi install` 対象。`streamSimple` で Pi ↔ driver を橋渡し |

```
modular-prompt（フレームワーク）
  └── @modular-prompt/driver   … AIService / AIDriver（MLX 等）
           ▲
           │ 依存・呼び出しのみ（driver は改変しない）
           │
  @modular-prompt/pi-provider-ext（npm パッケージ名）
  プラグイン ID: modular-prompt-provider
           ▲
           │ pi install / registerProvider
           │
         Pi エージェント
```

### プラグインとしての名前空間

Pi プラグインは **自分のプラグイン名だけ** をファイルシステム上の名前空間として使う。`modular-prompt` というフレームワークブランドの親ディレクトリ（例: `.pi/modular-prompt/`）を本プラグインが占有しない。

| 使ってよい | 使わない |
|---|---|
| `.pi/modular-prompt-provider/` | `.pi/modular-prompt/`（フレームワーク全体のように見える） |
| `registerProvider("modular-prompt-provider")` | `registerProvider("modular-prompt")`（フレームワーク名と混同） |
| `~/.pi/agent/modular-prompt-provider/` | `~/.modular-prompt/` 配下（driver 全体・CLI 向け設定の領域） |

npm パッケージ名 `@modular-prompt/pi-provider-ext` は **インストール単位** の名前。Pi 上のプロバイダ ID・設定ディレクトリは **`modular-prompt-provider`** で統一する。

## 設定の置き場所

本プラグインの設定は **Pi 公式の拡張独自設定パターン** に従う。専用の `pi.registerConfig()` API はない。

参照: [Pi extensions.md — ctx.cwd / CONFIG_DIR_NAME](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/extensions.md)

| 優先度 | パス | スコープ |
|---|---|---|
| 1（高） | `.pi/modular-prompt-provider/config.yaml` | プロジェクト（**trust 必須**） |
| 2 | `~/.pi/agent/modular-prompt-provider/config.yaml` | グローバル |
| 3 | 環境変数（例: `MODULAR_PROMPT_PI_MODEL`） | プロセス |
| 4 | `src/config.ts` デフォルト | コード |

ロードは async factory（`src/index.ts`）起動時に行う。プロジェクトローカルは `ctx.isProjectTrusted()` 判定後にマージする。trust 解決後は `session_start` でも再読込する。

```typescript
import { CONFIG_DIR_NAME, getAgentDir } from "@earendil-works/pi-coding-agent";
import { join } from "node:path";

const PLUGIN_DIR = "modular-prompt-provider";
const globalConfig = join(getAgentDir(), PLUGIN_DIR, "config.yaml");
const projectConfig = join(process.cwd(), CONFIG_DIR_NAME, PLUGIN_DIR, "config.yaml");
```

リポジトリ同梱のサンプル: [`modular-prompt-provider/config.yaml.example`](../modular-prompt-provider/config.yaml.example)

## Pi ネイティブ設定との役割分担

| 関心事 | 設定先 | 本プラグインでの扱い |
|---|---|---|
| モデル表示名・`contextWindow` 上書き | `~/.pi/agent/models.json` の `modelOverrides` | 読み取り専用連携（discovery #25 と併用可） |
| デフォルトプロバイダ・モデル | `settings.json` の `defaultProvider` / `defaultModel` | Pi 管轄。プラグインは `registerProvider` で登録のみ |
| ドライバ・モデル一覧・キャッシュ・ログ | `modular-prompt-provider/config.yaml` | **本プラグイン管轄** |

`models.json` に `cacheDir` や `pythonPath` を載せる公式スキーマはない。`modelOverrides` のプロバイダキーは **`modular-prompt-provider`**。

## データディレクトリ（ログ・キャッシュ）

設定と同じプラグイン名前空間の下に置く。Pi 本体の `agent/logs` とは別。

| 種別 | グローバル（デフォルト） | プロジェクト |
|---|---|---|
| 設定 | `~/.pi/agent/modular-prompt-provider/config.yaml` | `.pi/modular-prompt-provider/config.yaml` |
| KV キャッシュ | `~/.pi/agent/modular-prompt-provider/cache/` | `.pi/modular-prompt-provider/cache/` |
| リクエストログ | `~/.pi/agent/modular-prompt-provider/logs/requests/` | `.pi/modular-prompt-provider/logs/requests/` |

```typescript
const pluginDataDir = join(getAgentDir(), "modular-prompt-provider");
// cache: join(pluginDataDir, "cache")
// logs:  join(pluginDataDir, "logs", "requests")
```

会話履歴は Pi 標準の `~/.pi/agent/sessions/`。本プラグインの JSONL は LLM 呼び出しデバッグ用で、セッションファイルとは別。

## 設定ファイル例

```yaml
# ~/.pi/agent/modular-prompt-provider/config.yaml
# または .pi/modular-prompt-provider/config.yaml

models:
  - model: mlx-community/gemma-4-26B-A4B-it-heretic-4bit
    provider: mlx
    driverOptions:
      cacheDir: ~/.pi/agent/modular-prompt-provider/cache
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
  dir: ~/.pi/agent/modular-prompt-provider/logs/requests
```

`~` はロード時に展開する。`cacheDir` / `logging.dir` 未指定時は上記デフォルトをプラグインデータ dir から組み立てる。

### モデル discovery（#25）

`models[]` に列挙した MLX モデルは、プラグイン起動時（`loadAndRegister` / `session_start`）に `MlxDriver.getCapabilities()` でプローブし、`contextWindow`（`maxInputTokens`）・`reasoning`・`input`（vision）・`capabilities` タグを enrich してから `registerProvider` する。

| 項目 | 挙動 |
|---|---|
| 複数モデル | YAML `models[]` で宣言（固定 1 モデルに限定しない） |
| `maxInputTokens` | capabilities の `modelMaxLength`（YAML で `maxInputTokens` を**キーごと省略**した場合のみ discovery が反映。明示値は優先） |
| `reasoning` | `specialTokens.thinking` / `reasoning` の有無 |
| `vision` | `specialTokens.vision` かつ `driverOptions.textOnly` でない |
| `tools` | `chatTemplate.toolCallFormat` または `tool_call` トークン |
| 失敗時 | YAML / コードデフォルトのまま登録（起動継続）。`console.warn` に `[discovery]` ログ |
| 無効化 | `SKIP_MODEL_DISCOVERY=1`（テスト用） |

capabilities ベースのモデル**選択**（`selection`）は [#40](https://github.com/otolab/modular-prompt-pi-provider/issues/40) の範囲。

## KV キャッシュ管理（#30 Phase 2）

`cache` セクションは **pi-provider 側の `CacheManager`** が消費する。driver の `MlxCacheController` は retain/release ヒントのみで、TTL やディスク上限は持たない。

### 削除優先順（eviction）

1. `hint: release`（driver が不要とマークしたエントリ）
2. `maxAgeDays` 超過（`cache-index.json` の `createdAt`）
3. `maxSizeGb` 超過分を古い順に削除
4. `minFreeDiskGb` 未満なら追加削除
5. インデックス外の orphan `.safetensors`

### 実行タイミング

| タイミング | 設定 | 動作 |
|---|---|---|
| 設定ロード後（起動・`session_start`） | `sweepOnStartup` | 全 `cacheDir` を sweep |
| 新規キャッシュ書き込み前 | `sweepBeforeWrite` | 当該 `cacheDir` を sweep |
| `session_shutdown` / モデル切替（`pool.close`） | — | driver `close()` が `hint: release` にしたエントリを次回 sweep で削除（sessionId スコープの `release()` は [#30](https://github.com/otolab/modular-prompt-pi-provider/issues/30) Phase 3 予定） |
| Pi コマンド | — | `/cache show` / `/cache clean [--dry-run]` |

eviction 結果は `console.info` と JSONL（`server-{pid}.jsonl` の `eviction`）に記録する。詳細は [logging.md](./logging.md)。

`cache-index.json` は `proper-lockfile` でロックし、driver と共存する。

## 意図的に対応しないもの（現時点）

### `~/.modular-prompt-pi/config.yaml`

Pi エコシステム外のパス。本プラグインでは採用しない。

### `~/.modular-prompt/services.yaml`

`@modular-prompt/driver` 全体向けのサービス定義を将来 modular-prompt 側で導入する可能性がある。**現バージョンでは読み込まない**。導入時は本 `config.yaml` との優先順位・マージ方針を別 Issue で設計する。

### `.pi/modular-prompt/` 親ディレクトリ

modular-prompt フレームワーク全体の設定ディレクトリのように見えるため、本プラグインは **`modular-prompt-provider/` のみ** を使う。

## `models.json` との二重管理を避ける

| 設定したい内容 | 置き場所 | 本プラグインの扱い |
|---|---|---|
| `cacheDir` / `pythonPath` / `defaultOptions` | `modular-prompt-provider/config.yaml` | **読み込み・適用** |
| Pi UI の表示名・`contextWindow` | `models.json` `modelOverrides` | 読み取り専用（discovery #25 と併用可） |
| デフォルトモデル選択 | `settings.json` | Pi 管轄。上書きしない |

`models.json` に `cacheDir` 等を書いても本プラグインは参照しない。YAML の `models[].model` は Pi のモデル ID と一致させる。

## 関連 Issue

- [#41](https://github.com/otolab/modular-prompt-pi-provider/issues/41) — 設定ローダ実装
- [#30](https://github.com/otolab/modular-prompt-pi-provider/issues/30) — `cache` セクション
- [#42](https://github.com/otolab/modular-prompt-pi-provider/issues/42) — `logging` セクション
