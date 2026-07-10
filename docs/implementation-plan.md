# 実装計画

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

## 優先度

| 優先度 | 項目 | 完了条件 |
|---|---|---|
| **P0** | `streamSimple` 骨格 | `start` → `text_delta` → `done` |
| **P0** | `Context` → `CompiledPrompt` | 単純な user/assistant 往復 |
| **P0** | `MlxDriver.streamQuery` 連携 | ローカルモデルで Pi が応答 |
| **P1** | `toolcall_*`（result 後一括） | read/write ツールループが回る |
| **P1** | モデル discovery | `pi --list-models` に表示 |
| **P1** | `session_shutdown` → `close()` | プロセスリークなし |
| **P1** | `session_before_compact` + Prompt | 長セッションで手動 `/compact` |
| **P2** | 増分パーサ（thinking リアルタイム） | `<think>` が UI に漏れない |
| **P2** | `message_end` overflow リライト | overflow 後の自動リトライ |
| **P3** | `AbortSignal` | [#291](https://github.com/otolab/modular-prompt/issues/291) 後 |
| **P3** | `context` 剪定 | トークン節約 |

## マイルストーン

### M1: Hello MLX

- [ ] 固定モデル 1 つを `registerProvider`
- [ ] テキストのみ `streamSimple`
- [ ] `pi install` でロード確認

### M2: エージェントとして動く

- [ ] tool call 変換 + `toolUse` 終了
- [ ] 画像（VLM モデル時）
- [ ] 動的モデル一覧

### M3: 長セッション

- [ ] compact Prompt
- [ ] overflow リライト
- [ ] thinking 増分パーサ

### M4: 品質

- [ ] pi-ai テストスイート（可能な範囲）
- [ ] npm publish

## テスト

### Pi 公式（`@earendil-works/pi-ai`）

| テスト | 内容 | 依存 |
|---|---|---|
| `stream.test.ts` | イベント順序 | M1 |
| `tokens.test.ts` | usage | M1 |
| `abort.test.ts` | AbortSignal | #291 |
| `context-overflow.test.ts` | overflow リライト | M3 |
| `tool-call-without-result.test.ts` | ツールシーケンス | M2 |

### 本リポジトリ（予定）

| テスト | 内容 |
|---|---|
| `message-mapper.test.ts` | Pi ↔ MessageElement |
| `incremental-parser.test.ts` | thinking タグ分割 |
| `options.test.ts` | reasoning マッピング |

ユニットテストは vitest。MLX 統合は手動 + Pi セッション。

## 既知の依存関係

| ブロッカー | 影響 | 回避 |
|---|---|---|
| [#291](https://github.com/otolab/modular-prompt/issues/291) AbortSignal | `abort.test.ts` | クライアント側打ち切りのみ |
| [#254](https://github.com/otolab/modular-prompt/issues/254) MLX ハング | セッション不安定 | abort 実装時に整合確認 |

## ステータス

現在: **M0（スケルトン）** — `src/index.ts` にスタブのみ。
