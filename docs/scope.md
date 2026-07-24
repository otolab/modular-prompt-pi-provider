# 実装スコープ

modular-prompt への要求と、本リポジトリ（`@modular-prompt/pi-provider-ext`）で実装する **Pi プラグイン** `modular-prompt-provider` の範囲の整理。

- driver 側の仕様: [modular-prompt#291](https://github.com/otolab/modular-prompt/issues/291#issuecomment-4933631155)（**対応済み** `@modular-prompt/driver` **0.14.0+**）
- 実装計画・ファイル構成: [implementation-plan.md](./implementation-plan.md)
- modular-prompt / Pi / プラグインの関係: [configuration.md](./configuration.md#modular-promptpi本プラグインの関係)

## 前提

| 項目 | バージョン |
|---|---|
| `@modular-prompt/driver` | **^0.14.0**（modular-prompt monorepo v0.17.0 に同梱） |
| Pi | `@earendil-works/pi-ai` / `pi-coding-agent`（peer） |

driver は `QueryOptions.signal`、`result.usage`（`cacheReadTokens` / `cacheWriteTokens` 含む）を提供する。`StreamResult` の形（`stream` = テキスト、`usage` = `result`）は変わらない。

## modular-prompt 側（対応済み）

| 項目 | driver での提供 |
|---|---|
| `QueryOptions.signal` | abort 時に推論停止。`result` は reject せず `finishReason: 'error'` |
| `result.usage` | `promptTokens` / `completionTokens` / `totalTokens` |
| `cacheReadTokens` / `cacheWriteTokens` | KV キャッシュ利用時（MLX） |

## 本リポジトリの実装範囲

| 優先度 | 項目 | 完了条件 | 状態 |
|---|---|---|---|
| **P0** | `streamSimple` 骨格 | `start` → `text_delta` → `done` | ✅ コード |
| **P0** | `Context` → `CompiledPrompt` | user/assistant 往復が動く | ✅ コード |
| **P0** | `AIDriver.streamQuery` 連携 | ローカルモデルで Pi が応答 | ✅ コード（実機未検証） |
| **P0** | Pi `Usage` マッピング | `result.usage` → `output.usage`（[adapter.md](./adapter.md)） | ✅ コード + ユニット |
| **P0** | `signal` 伝播と abort 変換 | `QueryOptions.signal` に渡し、`finishReason: 'error'` + `signal.aborted` → `"aborted"`（[abort-spec.md](./abort-spec.md)） | ✅ コード + ユニット |
| **P1** | `toolcall_*` | `result` 後の一括発行でツールループが回る | — |
| **P1** | モデル discovery | `pi --list-models` に表示（`getCapabilities` 連携） | ✅ コード（実機未検証） |
| **P1** | `session_shutdown` → `close()` | プロセスリークなし | — |
| **P1** | `session_before_compact` + Prompt | 手動 `/compact` | — |
| **P2** | 増分パーサ | `thinking_*` リアルタイム。タグが UI に漏れない | — |
| **P2** | `message_end` overflow リライト | unit + Pi `context-overflow`（#35） | ✅ unit |
| **P3** | `context` 剪定 | トークン節約 | — |

## 責務の境界

| 層 | やること | やらないこと |
|---|---|---|
| **modular-prompt driver** | 推論、`AIDriver` 実装（MLX 等）、`result.usage` の生トークン、abort 時のバックエンド停止 | Pi イベント生成、`Usage.input` の計算 |
| **本拡張** | `streamSimple`、型変換、生ストリーム → Pi イベント、`result` → Pi `Usage`、abort → Pi `stopReason`、モデル登録（`ApplicationConfig`）、compact Prompt | MLX 子プロセス制御、driver API の変更 |
| **Pi コア** | エージェントループ、ツール実行、デフォルト compact | — |

## 残課題・検証

| 項目 | 内容 |
|---|---|
| `pi install` 実機 | Gemma 4bit で応答・モデル選択が動くか |
| MLX 実機 abort | ストリーム途中 abort → 次 `streamQuery` 正常（[#254](https://github.com/otolab/modular-prompt/issues/254) との整合） |
| Pi `abort.test.ts` | 本拡張 + driver の結合で検証 |
| Pi `tokens.test.ts` | `mapQueryResultUsageToPi` + driver `result.usage` |
| thinking タグ | M1 は生 `text_delta` のため UI 露出の可能性あり（P2 で解消） |

## マイルストーン

### M1: Hello MLX（**検証残**）

- ✅ `AIService` + 固定モデル登録、`streamSimple`、usage マッピング、signal 伝播（コード + ユニットテスト）
- ⬜ `pi install` でロード・応答確認
- ⬜ Pi 公式 `stream` / `tokens` / `abort` テスト

### M2: エージェントとして動く

- tool call、`getCapabilities` によるモデル一覧拡張
- `session_shutdown`

### M3: 長セッション・品質

- compact、overflow リライト、増分パーサ
- `abort.test.ts` / `tokens.test.ts` 本番品質

### M4: 配布

- pi-ai テストスイート（可能な範囲）、npm publish
