# 実装計画

スコープの全体像は [scope.md](./scope.md) を参照。

## ソース構成

### 現状（`src/`）

```
modular-prompt-pi-provider/
  package.json
  vitest.config.ts              # ユニットテスト
  vitest.integration.config.ts  # MLX 実機インテグレーション
  test/                         # ユニットテスト ✅
  tests/integration/            # MLX 実機インテグレーション ✅
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
      cache-options.ts       ✅（#30 P1: QueryOptions.cache）
      usage.ts               ✅
      finish-reason.ts       ✅
      stream-bridge.ts       ✅（M1: 生 text_delta。sweepBeforeWrite 配線 #30 P2）
    cache/
      cache-policy.ts        ✅（#30 P2: YAML cache セクション）
      cache-dirs.ts          ✅
      disk-usage.ts          ✅
      cache-manager.ts       ✅（index ロック・eviction）
      runtime.ts             ✅（startup / before-write sweep）
      session-context.ts     ✅（#30 P1: sessionId 保持）
    hooks/
      session.ts             ✅（session_shutdown → close）
      cache-commands.ts      ✅（/cache show | clean）
    logging/
      log-policy.ts          ✅（#42: YAML logging セクション）
      request-logger.ts      ✅（リクエスト JSONL）
      process-logger.ts      ✅（eviction 等）
      runtime.ts             ✅
      extract-log.ts         ✅（sprite-claude 移植 + --dir）
    driver/
      service.ts             # AIService シングルトン ✅
      pool.ts                # AIDriver 単一保持・切替 ✅
      model-catalog.ts       # ModelSpec → Pi models ✅
  docs/
```

### 未実装（予定）

```
  src/
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

| 種別 | 場所 | コマンド |
|---|---|---|
| ユニット | `test/**/*.test.ts` | `npm run test:run` |
| インテグレーション | `tests/integration/**/*.test.ts` | `npm run test:integration` |

`npm test`（watch）はユニットのみ。両方: `npm run test:all`。

**MLX モデルを載せるテストは逐次実行のみ**（`fileParallelism: false` / `maxWorkers: 1`）。

### インテグレーション（MLX 実機）

| 項目 | 内容 |
|---|---|
| デフォルトモデル | [`prism-ml/Ternary-Bonsai-1.7B-mlx-2bit`](https://huggingface.co/prism-ml/Ternary-Bonsai-1.7B-mlx-2bit) |
| 選定理由 | text-only LM（KV キャッシュ対応）。1.7B 2bit でインテグレーションのサイズ・速度に最適 |
| 上書き | `INTEGRATION_MLX_MODEL` 環境変数 |
| スキップ | `SKIP_INTEGRATION=1`、または MLX 未導入・VLM 等でプローブ失敗時 |
| 主なテスト | `tests/integration/cache-hit.test.ts`（KV キャッシュ hit / `cacheRetention: none` / read-only） |

アプリのコードデフォルト（Gemma 4 VLM）は KV キャッシュ非対応のため、インテグレーションでは **`MODULAR_PROMPT_PI_MODEL` にフォールバックしない**。

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
| `test/cache-options.test.ts` | `QueryOptions.cache` マッピング | ✅ |
| `test/cache-policy.test.ts` | `resolveCachePolicy` | ✅ |
| `test/cache-manager.test.ts` | eviction（release / age / size / disk / orphan） | ✅ |
| `test/cache-runtime.test.ts` | startup / before-write sweep 配線 | ✅ |
| `test/log-policy.test.ts` | `resolveLoggingPolicy` | ✅ |
| `test/request-logger.test.ts` | JSONL 記録 | ✅ |
| `test/stream-events.test.ts` | ストリーム契約（TestDriver） | ✅ |
| `tests/integration/cache-hit.test.ts` | MLX KV キャッシュ（実機） | ✅ |
| `incremental-parser.test.ts` | thinking タグ分割 | 未実装（P2） |

ユニットテストは vitest。MLX 実機は `tests/integration/`（`vitest.integration.config.ts`）。Pi 公式テスト（stream / tokens / abort）は別途。

## ステータス

**M1 コード完了・検証残** — P0 実装とユニットテストは完了。残りは `pi install` 実機確認と Pi 公式テスト（stream / tokens / abort）。
