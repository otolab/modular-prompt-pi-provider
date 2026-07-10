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
      options.ts
      usage.ts               # QueryResult → Pi Usage
      stream-bridge.ts
      incremental-parser.ts
      finish-reason.ts
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

[scope.md](./scope.md) と同一。実装順の目安:

1. **P0** — `stream-simple` + adapter + usage マッピング
2. **P1** — ツール、discovery、セッション、#291 後に signal
3. **P2** — 増分パーサ、overflow
4. **P3** — context 剪定

## テスト

### Pi 公式（`@earendil-works/pi-ai`）

| テスト | 内容 | 依存 |
|---|---|---|
| `stream.test.ts` | イベント順序 | M1 |
| `tokens.test.ts` | usage | M1 + #291 P1 |
| `abort.test.ts` | AbortSignal | M3 + #291 P0 |
| `context-overflow.test.ts` | overflow リライト | M3 |
| `tool-call-without-result.test.ts` | ツールシーケンス | M2 |

### 本リポジトリ（予定）

| テスト | 内容 |
|---|---|
| `message-mapper.test.ts` | Pi ↔ MessageElement |
| `usage.test.ts` | `QueryResult` → Pi `Usage` |
| `incremental-parser.test.ts` | thinking タグ分割 |
| `options.test.ts` | reasoning / signal マッピング |

ユニットテストは vitest。MLX 統合は手動 + Pi セッション。

## ステータス

現在: **M0（スケルトン）** — `src/index.ts` にスタブのみ。
