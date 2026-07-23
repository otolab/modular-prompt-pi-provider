# アーキテクチャ

## 目的

[Pi](https://github.com/earendil-works/pi) のエージェントループから、HTTP 互換サーバーを経由せず [`@modular-prompt/driver`](https://github.com/otolab/modular-prompt) の **`AIDriver`**（MLX 実装含む）を呼び出す。

OpenAI 互換ラッパー（Ollama / Rapid-MLX 等）では活かしきれないもの:

- MLX 子プロセス直制御（prompt cache、`MlxCacheController`）
- モデル固有 tool call パーサー
- VLM / completion API の自動切り替え

## 三者の関係

| 名前 | 役割 |
|---|---|
| **modular-prompt** | プロンプトモジュール・`AIService` / `AIDriver` を持つフレームワーク（Pi 非依存） |
| **Pi** | エージェント本体。プラグインを読み込み LLM プロバイダを選択する |
| **modular-prompt-provider** | 本リポジトリのプラグイン ID。driver を Pi の `registerProvider` に接続する |

npm パッケージ名 `@modular-prompt/pi-provider-ext` は配布名。ランタイム上のプロバイダ ID・設定ディレクトリは [configuration.md](./configuration.md) のとおり **`modular-prompt-provider`**。

## レイヤ構成

```
┌─────────────────────────────────────────────────────────────┐
│ Pi Agent Loop                                                │
│   tools: read / write / edit / bash …                        │
│   プロバイダ: modular-prompt-provider                        │
└───────────────────────────┬─────────────────────────────────┘
                            │ Context, SimpleStreamOptions
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ @modular-prompt/pi-provider-ext（本リポジトリ / Pi プラグイン）  │
│                                                              │
│  index.ts              ExtensionAPI エントリ                  │
│  config.ts             ApplicationConfig / モデル登録         │
│  stream-simple.ts      streamSimple 実装                      │
│  adapter/              Pi ↔ modular-prompt 変換              │
│  driver/               AIService, AIDriver プール             │
│  prompts/              compact 用テンプレート（予定）          │
│  hooks/                message_end, session_before_compact   │
└───────────────────────────┬─────────────────────────────────┘
                            │ CompiledPrompt, QueryOptions
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ @modular-prompt/driver（依存・改変しない）                      │
│  AIService → AIDriver.streamQuery() / close()                │
│  （MLX はファクトリ経由で MlxDriver インスタンス化）            │
└───────────────────────────┬─────────────────────────────────┘
                            │ stdin/stdout JSON
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ Python mlx server（driver 同梱）                               │
│  mlx-vlm / mlx-lm                                            │
└───────────────────────────┬─────────────────────────────────┘
                            ▼
                          MLX (Metal)
```

## 責務分担

| 層 | 責務 | 実装場所 |
|---|---|---|
| Pi コア | エージェントループ、ツール実行、デフォルト compact | Pi 本体 |
| **本プラグイン** | プロバイダ登録、`streamSimple`、型変換、増分パーサ、`result` → Pi `Usage`、モデル登録、compact Prompt、overflow リライト | 本リポジトリ |
| modular-prompt | `AIDriver` 実装、推論、`result.usage`、`QueryOptions.signal`（driver 0.14.0+） | driver パッケージ |

## 設計原則

1. **`Context` → `CompiledPrompt` の変換は本プラグインの責務** — driver に `streamFromMessages` は追加しない（[modular-prompt#291 コメント](https://github.com/otolab/modular-prompt/issues/291#issuecomment-4933094279)）
2. **独自 `api` ID** — `api: "modular-prompt-provider"`。`openai-completions` 流用は内蔵プロバイダと競合（[pi#2696](https://github.com/earendil-works/pi/issues/2696)）
3. **`MlxDriver` を直接 new しない** — `AIService` + `ApplicationConfig.models` で登録し、`AIDriver` として利用。将来ドライバ追加に備える
4. **論理モデルごとに driver シングルトン** — `driver/model-registry.ts`。切替時も同一論理名は再利用、`session_shutdown` で `closeAllDrivers()`
5. **ファクトリ内で MLX プロセスを起動しない** — 初回 `streamSimple` で遅延初期化（`model-registry` 経由）
6. **エラーは throw しない** — `streamSimple` は `error` イベントで返す（Pi 契約）
7. **プラグイン名だけを名前空間に使う** — 設定・データは `modular-prompt-provider/` の下のみ（[configuration.md](./configuration.md)）

## モデル設定（Issue #40 Phase 1）

| 項目 | 値 |
|---|---|
| 登録 | `modular-prompt-provider/config.yaml` → 論理名 `models` → `ApplicationConfig.models` |
| Pi `model.id` | 論理名（または `workflow.*.virtualModel`） |
| 物理モデル | 論理名 `default`、物理モデル `prism-ml/Ternary-Bonsai-1.7B-mlx-2bit` |
| 上書き | 環境変数 `MODULAR_PROMPT_PI_MODEL`（物理パス） |
| Pi 表示 | `model-catalog.buildPiProviderModels` が論理名 + virtualModel を生成 |

詳細: [workflow.md](./workflow.md)

## Driver プール

| 項目 | 値 |
|---|---|
| 保持単位 | **論理モデルごと** 1 インスタンス（`model-registry.ts`） |
| 切替 | 同一論理名は再利用。`closeAllDrivers()` で全解放 |
| 旧制約 | プロセス全体で MLX 1 つ — **撤廃**（Issue #40） |

## プロバイダ ID

| 定数 | 値 |
|---|---|
| `PROVIDER_ID` | `modular-prompt-provider` |
| `API_ID` | `modular-prompt-provider` |

`registerProvider` の第1引数と `Model.api` / `streamSimple` 登録で一貫させる。
