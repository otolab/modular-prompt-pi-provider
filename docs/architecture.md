# アーキテクチャ

## 目的

[Pi](https://github.com/earendil-works/pi) のエージェントループから、HTTP 互換サーバーを経由せず [`@modular-prompt/driver`](https://github.com/otolab/modular-prompt) の **`AIDriver`**（MLX 実装含む）を呼び出す。

OpenAI 互換ラッパー（Ollama / Rapid-MLX 等）では活かしきれないもの:

- MLX 子プロセス直制御（prompt cache、`MlxCacheController`）
- モデル固有 tool call パーサー
- VLM / completion API の自動切り替え

## レイヤ構成

```
┌─────────────────────────────────────────────────────────────┐
│ Pi Agent Loop                                                │
│   tools: read / write / edit / bash …                        │
└───────────────────────────┬─────────────────────────────────┘
                            │ Context, SimpleStreamOptions
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ @modular-prompt/pi-provider-ext（本リポジトリ）                 │
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
| **本拡張** | プロバイダ登録、`streamSimple`、型変換、増分パーサ、`result` → Pi `Usage`、モデル登録、compact Prompt、overflow リライト | 本リポジトリ |
| modular-prompt | `AIDriver` 実装、推論、`result.usage`、`QueryOptions.signal`（driver 0.14.0+） | driver パッケージ |

## 設計原則

1. **`Context` → `CompiledPrompt` の変換は本拡張の責務** — driver に `streamFromMessages` は追加しない（[modular-prompt#291 コメント](https://github.com/otolab/modular-prompt/issues/291#issuecomment-4933094279)）
2. **独自 `api` ID** — `api: "modular-prompt-mlx"`。`openai-completions` 流用は内蔵プロバイダと競合（[pi#2696](https://github.com/earendil-works/pi/issues/2696)）
3. **`MlxDriver` を直接 new しない** — `AIService` + `ApplicationConfig.models` で登録し、`AIDriver` として利用。将来プロバイダ追加に備える
4. **MLX は同時 1 ドライバ** — メモリ制約のため `driver/pool.ts` は単一インスタンス。切替時 `close()`
5. **ファクトリ内で MLX プロセスを起動しない** — 初回 `streamSimple` で遅延初期化（`pool` 経由）
6. **エラーは throw しない** — `streamSimple` は `error` イベントで返す（Pi 契約）

## モデル設定（M1）

| 項目 | 値 |
|---|---|
| 登録 | `src/config.ts` の `ApplicationConfig.models` |
| デフォルト | `mlx-community/gemma-4-26B-A4B-it-heretic-4bit` |
| 上書き | 環境変数 `MODULAR_PROMPT_PI_MODEL` |
| Pi 表示 | `model-catalog.ts` が `ModelSpec` → `registerProvider` の `models` に変換 |

## プロバイダ ID

| 定数 | 値 |
|---|---|
| `PROVIDER_ID` | `modular-prompt-mlx` |
| `API_ID` | `modular-prompt-mlx` |

`registerProvider` の第1引数と `Model.api` / `streamSimple` 登録で一貫させる。
