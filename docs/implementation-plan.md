# 実装計画

スコープの全体像は [scope.md](./scope.md) を参照。

## ソース構成

### 現状（`src/`）

```
modular-prompt-pi-provider/
  package.json
  vitest.config.ts
  .search-docs.json
  src/
    index.ts                 # ExtensionAPI エントリ ✅
    constants.ts             # PROVIDER_ID, API_ID ✅
    config.ts                # ApplicationConfig / デフォルトモデル ✅
    stream-simple.ts         # streamModularPromptMlx ✅
    adapter/
      context-to-prompt.ts   ✅
      message-mapper.ts      ✅
      options.ts             ✅
      usage.ts               ✅
      finish-reason.ts       ✅
      stream-bridge.ts       ✅（M1: 生 text_delta。増分パーサなし）
    driver/
      service.ts             # AIService シングルトン ✅
      pool.ts                # AIDriver 単一保持・切替 ✅
      model-catalog.ts       # ModelSpec → Pi models ✅
  test/                      # vitest ユニットテスト ✅
  docs/
```

### 未実装（予定）

```
    adapter/
      tools.ts               # P1
      incremental-parser.ts  # P2
    driver/
      discovery.ts           # P1（getCapabilities → ModelSpec 拡張）
    hooks/
      overflow-rewrite.ts    # P2
      compaction.ts          # P1
    prompts/
      compaction.ts          # P1
```

## 設計方針（M1 時点）

| 項目 | 方針 |
|---|---|
| ドライバ接続 | **`AIDriver` 共通インターフェイス**（`streamQuery` / `close`）。`MlxDriver` を直接 new しない |
| モデル登録 | **`AIService` + `ApplicationConfig.models`**（`src/config.ts`）。Pi `registerProvider` の `models` は同設定から生成 |
| デフォルトモデル | `mlx-community/gemma-4-26B-A4B-it-heretic-4bit`。`MODULAR_PROMPT_PI_MODEL` で上書き |
| ドライバプール | **同時 1 インスタンス**（MLX メモリ制約）。モデル切替時は `close()` して再作成 |
| ストリーム | M1 は `stream` を `text_delta` に直結。thinking タグ分離は P2 増分パーサ |

## 優先度（本リポジトリ）

[scope.md](./scope.md) と同一。実装順:

1. **P0** — `stream-simple` + adapter（context / options / usage / finish-reason / stream-bridge）— **コード完了**
2. **P1** — ツール、discovery、セッション
3. **P2** — 増分パーサ、overflow
4. **P3** — context 剪定

### P0 実装タスク（M1）

| ファイル | 内容 | 状態 |
|---|---|---|
| `constants.ts` | `PROVIDER_ID`, `API_ID` | ✅ |
| `config.ts` | `ApplicationConfig` / モデル登録 | ✅ |
| `adapter/context-to-prompt.ts` | `piContextToCompiledPrompt` | ✅ |
| `adapter/message-mapper.ts` | Pi `Message` → `MessageElement` | ✅ |
| `adapter/options.ts` | `piOptionsToQueryOptions`（`signal` 含む） | ✅ |
| `adapter/usage.ts` | `mapQueryResultUsageToPi` | ✅ |
| `adapter/finish-reason.ts` | abort / error 判定 | ✅ |
| `adapter/stream-bridge.ts` | `AIDriver` stream → Pi イベント | ✅ |
| `stream-simple.ts` | `registerProvider` + `streamSimple` | ✅ |
| `driver/service.ts` | `AIService` | ✅ |
| `driver/pool.ts` | `AIDriver` 遅延初期化・単一保持 | ✅ |
| `driver/model-catalog.ts` | `ModelSpec` → Pi `models` | ✅ |

## テスト

`npm test`（watch）/ `npm run test:run`（1 回）。**MLX モデルを載せるテストは逐次実行のみ**（`vitest.config.ts` で `fileParallelism: false`）。

### Pi 公式（`@earendil-works/pi-ai`）

| テスト | 内容 | タイミング | 状態 |
|---|---|---|---|
| `stream.test.ts` | イベント順序 | M1 | 未実施 |
| `tokens.test.ts` | usage | M1 | 未実施 |
| `abort.test.ts` | AbortSignal | M1（driver 0.14.0+ 前提） | 未実施 |
| `tool-call-without-result.test.ts` | ツールシーケンス | M2 | — |
| `context-overflow.test.ts` | overflow リライト | M3 | — |

### 本リポジトリ

| テスト | 内容 | 状態 |
|---|---|---|
| `test/usage.test.ts` | `mapQueryResultUsageToPi` | ✅ |
| `test/finish-reason.test.ts` | abort / error 判定 | ✅ |
| `test/options.test.ts` | `signal` / reasoning マッピング | ✅ |
| `test/message-mapper.test.ts` | Pi ↔ MessageElement | ✅ |
| `test/config.test.ts` | モデル登録・デフォルト | ✅ |
| `incremental-parser.test.ts` | thinking タグ分割 | 未実装（P2） |

ユニットテストは vitest。devDependency に `@modular-prompt/experiment`（性能試験フレームワーク・将来の統合テスト参照用）。MLX 統合は手動 + Pi セッション。

## ステータス

**M1 コード完了・検証残** — P0 実装とユニットテストは完了。残りは `pi install` 実機確認と Pi 公式テスト（stream / tokens / abort）。
