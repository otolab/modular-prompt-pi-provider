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
    stream-simple.ts         # streamModularPrompt ✅
    adapter/
      context-to-prompt.ts   ✅
      message-mapper.ts      ✅
      options.ts             ✅
      cache-options.ts       ✅（#30 P1: QueryOptions.cache）
      usage.ts               ✅
      finish-reason.ts       ✅
      tools.ts               ✅
      toolcall-emitter.ts    ✅
      stream-bridge.ts       ✅（workflow 解決 + stream / agentic 橋渡し）
    config/
      types.ts               ✅（#40: 新 YAML 型）
      normalize-config.ts    ✅
      resolve-selection.ts   ✅
      resolve-model-set.ts   ✅
      validate-config.ts     ✅
    workflow/
      passthrough.ts         ✅（#40 Phase 2）
      runner.ts              ✅
      run-virtual.ts         ✅
      agentic.ts             ✅（#40 Phase 3）
      driver-set.ts          ✅
      agentic-logging.ts     ✅
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
    extract-log/             ✅（sprite-claude 移植 CLI）
    driver/
      service.ts             ✅
      pool.ts                ✅（`model-registry` への薄いラッパー）
      model-registry.ts      ✅（論理モデルごと driver シングルトン #40）
      model-catalog.ts       ✅
      discovery.ts           ✅（#25）
      cache-stats.ts         ✅
  docs/
    workflow.md              ✅（#40 設計）
```

### 未実装（予定）

```
  src/
    adapter/
      incremental-parser.ts  # P2
    hooks/
      overflow-rewrite.ts    # P2
      compaction.ts          # P1（#56 フォローアップ）
    prompts/
      compaction.ts          # P1
```

## 設計方針（現行）

| 項目 | 方針 |
|---|---|
| ドライバ接続 | **`AIDriver` 共通インターフェイス**（`streamQuery` / `close`） |
| モデル設定 | YAML `providers` / `models` / `modelSets` / `workflow` / `processes`（[workflow.md](./workflow.md)） |
| Pi `model.id` | 論理名または `virtualModel`。解決は `resolve-selection.ts` |
| ドライバ保持 | **論理モデルごと 1 インスタンス**（`model-registry.ts`）。inflight dedup |
| 推論実行 | **workflow 経由**（passthrough ストリーム / agentic 非ストリーム） |
| ストリーム | passthrough は `text_delta` 直結。thinking タグ分離は P2 増分パーサ |

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
| `driver/pool.ts` | 後方互換ラッパー（実体は `model-registry.ts`） | ✅ |
| `driver/model-registry.ts` | 論理モデルごと driver | ✅ |
| `workflow/passthrough.ts` | passthrough ストリーム | ✅ |
| `workflow/agentic.ts` | agentic workflow | ✅ |

## テスト

詳細は [testing.md](./testing.md) を参照。

| 種別 | 場所 | コマンド |
|---|---|---|
| ユニット | `test/**/*.test.ts` | `npm run test:run` |
| インテグレーション | `tests/integration/**/*.test.ts` | `npm run test:integration` |
| 実験・品質 | `compact:experimental` 等 | 手動（CI 対象外） |

`npm test`（watch）はユニットのみ。両方: `npm run test:all`。

**MLX モデルを載せるテストは逐次実行のみ**（`fileParallelism: false` / `maxWorkers: 1`）。

### インテグレーション（MLX 実機）

| 項目 | 内容 |
|---|---|
| デフォルトモデル | [`prism-ml/Ternary-Bonsai-1.7B-mlx-2bit`](https://huggingface.co/prism-ml/Ternary-Bonsai-1.7B-mlx-2bit) |
| 選定理由 | text-only LM（KV キャッシュ対応）。1.7B 2bit でインテグレーションのサイズ・速度に最適 |
| 上書き | `INTEGRATION_MLX_MODEL` 環境変数 |
| スキップ | `SKIP_INTEGRATION=1`、または MLX 未導入・VLM 等でプローブ失敗時 |
| 主なテスト | `workflow-stream.test.ts`（workflow）、`cache-hit.test.ts`（KV キャッシュ）、`compact-engine.test.ts`（compact 要約） |

アプリのコードデフォルトも [`prism-ml/Ternary-Bonsai-1.7B-mlx-2bit`](https://huggingface.co/prism-ml/Ternary-Bonsai-1.7B-mlx-2bit)（text LM・KV キャッシュ対応）。インテグレーションは **`MODULAR_PROMPT_PI_MODEL` にフォールバックしない**（`INTEGRATION_MLX_MODEL` で上書き）。

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
| `test/cache-stats.test.ts` | `getCacheStats` | ✅ |
| `test/discovery.test.ts` | `getCapabilities` → ModelSpec enrich | ✅ |
| `test/workflow-passthrough.test.ts` | passthrough workflow | ✅ |
| `test/workflow-virtual.test.ts` | DriverSet 構築 | ✅ |
| `test/agentic-logging.test.ts` | agentic ログ抽出 | ✅ |
| `test/validate-config.test.ts` | config 簡易バリデーション | ✅ |
| `test/resolve-selection.test.ts` | model.id 解決 | ✅ |
| `test/stream-events.test.ts` | ストリーム契約（TestDriver） | ✅ |
| `tests/integration/workflow-stream.test.ts` | MLX workflow stream（#56） | ✅ |
| `tests/integration/cache-hit.test.ts` | MLX KV キャッシュ（実機） | ✅ |
| `tests/integration/compact-engine.test.ts` | MLX compact 要約（実機） | ✅ |

ユニットテストは vitest。MLX 実機は `tests/integration/`（`vitest.integration.config.ts`）。Pi 公式テスト（stream / tokens / abort）は別途。

## ステータス

**#40 Phase 1〜3 コード完了**（PR #50 / #52 / #55 マージ済み）。残りは [#56](https://github.com/otolab/modular-prompt-pi-provider/issues/56)（MLX 実機確認・compact 等）と Pi 公式テスト（stream / tokens / abort）。
