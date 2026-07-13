# 実装計画

スコープの全体像は [scope.md](./scope.md) を参照。

## ソース構成（目標）

```
modular-prompt-pi-provider/
  package.json
  src/
    index.ts                 # ExtensionAPI エントリ
    constants.ts             # PROVIDER_ID, API_ID
    stream-simple.ts         # streamModularPromptMlx
    adapter/
      context-to-prompt.ts
      message-mapper.ts
      tools.ts
      options.ts             # signal 伝播含む
      usage.ts               # QueryResult → Pi Usage
      stream-bridge.ts
      incremental-parser.ts
      finish-reason.ts       # error + signal.aborted → aborted
    driver/
      pool.ts                # MlxDriver インスタンス管理
      discovery.ts           # getCapabilities → ProviderModelConfig
    hooks/
      overflow-rewrite.ts
      compaction.ts
    prompts/
      compaction.ts
  docs/
```

## 優先度（本リポジトリ）

[scope.md](./scope.md) と同一。実装順:

1. **P0** — `stream-simple` + adapter（context / options / usage / finish-reason / stream-bridge）
2. **P1** — ツール、discovery、セッション
3. **P2** — 増分パーサ、overflow
4. **P3** — context 剪定

### P0 実装タスク（M1）

| ファイル | 内容 |
|---|---|
| `constants.ts` | `PROVIDER_ID`, `API_ID` |
| `adapter/context-to-prompt.ts` | `piContextToCompiledPrompt` |
| `adapter/message-mapper.ts` | Pi `Message` → `MessageElement` |
| `adapter/options.ts` | `piOptionsToQueryOptions`（`signal` 含む） |
| `adapter/usage.ts` | `mapQueryResultUsageToPi` |
| `adapter/finish-reason.ts` | `mapStopReason`, abort 判定 |
| `adapter/stream-bridge.ts` | MLX stream → Pi イベント |
| `stream-simple.ts` | `registerProvider` + `streamSimple` |
| `driver/pool.ts` | `MlxDriver` 遅延初期化 |

## テスト

### Pi 公式（`@earendil-works/pi-ai`）

| テスト | 内容 | タイミング |
|---|---|---|
| `stream.test.ts` | イベント順序 | M1 |
| `tokens.test.ts` | usage | M1 |
| `abort.test.ts` | AbortSignal | M1（driver 0.14.0+ 前提） |
| `tool-call-without-result.test.ts` | ツールシーケンス | M2 |
| `context-overflow.test.ts` | overflow リライト | M3 |

### 本リポジトリ（予定）

| テスト | 内容 |
|---|---|
| `usage.test.ts` | `mapQueryResultUsageToPi`（`input` 計算、cache 系） |
| `finish-reason.test.ts` | abort / error 判定 |
| `options.test.ts` | `signal` / reasoning マッピング |
| `message-mapper.test.ts` | Pi ↔ MessageElement |
| `incremental-parser.test.ts` | thinking タグ分割 |

ユニットテストは vitest。MLX 統合は手動 + Pi セッション。

## ステータス

**M1 着手** — driver 0.14.0+ 前提で P0 実装中。`src/index.ts` はスタブのまま。
