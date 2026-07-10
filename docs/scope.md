# 実装スコープ

modular-prompt への要求と、本リポジトリ（`@modular-prompt/pi-provider-ext`）で実装する範囲の整理。

- driver 側の要求詳細: [modular-prompt#291](https://github.com/otolab/modular-prompt/issues/291#issuecomment-4933631155)
- 実装計画・ファイル構成: [implementation-plan.md](./implementation-plan.md)

## modular-prompt への要求

`StreamResult`（`stream` はテキスト、`usage` は `result`）は現状のまま変更しない。足すのは次のみ。

| 優先度 | 項目 | 内容 |
|---|---|---|
| **P0** | `QueryOptions.signal` | abort 時に推論停止。`result` は reject せず `finishReason: 'error'` で resolve |
| **P1** | `result.usage` の充足 | `promptTokens` / `completionTokens` / `totalTokens` を返す（MLX は現状未充足） |
| **P2** | `usage` の cache 系 | `cacheReadTokens?` / `cacheWriteTokens?` を追加。`promptTokens` の分解は driver 側では行わない |

## 本リポジトリの実装範囲

| 優先度 | 項目 | 完了条件 |
|---|---|---|
| **P0** | `streamSimple` 骨格 | `start` → `text_delta` → `done` |
| **P0** | `Context` → `CompiledPrompt` | user/assistant 往復が動く |
| **P0** | `MlxDriver.streamQuery` 連携 | ローカルモデルで Pi が応答 |
| **P0** | Pi `Usage` マッピング | `result` から `output.usage` を組み立て、`done` / `error` に載せる（[adapter.md](./adapter.md)） |
| **P1** | `toolcall_*` | `result` 後の一括発行でツールループが回る |
| **P1** | モデル discovery | `pi --list-models` に表示 |
| **P1** | `session_shutdown` → `close()` | プロセスリークなし |
| **P1** | `session_before_compact` + Prompt | 手動 `/compact` |
| **P1** | `QueryOptions.signal` 伝播 | #291 マージ後。`abort-spec.md` に従い Pi イベントへ変換 |
| **P2** | 増分パーサ | `thinking_*` リアルタイム。タグが UI に漏れない |
| **P2** | `message_end` overflow リライト | overflow 後の自動リトライ |
| **P3** | `context` 剪定 | トークン節約 |

## 責務の境界

| 層 | やること | やらないこと |
|---|---|---|
| **modular-prompt driver** | 推論、`result.usage` の生トークン、abort 時のバックエンド停止 | Pi イベント生成、`Usage.input` の計算 |
| **本拡張** | `streamSimple`、型変換、生ストリーム → Pi イベント、`result` → Pi `Usage`、compact Prompt | MLX 子プロセス制御、driver API の変更 |
| **Pi コア** | エージェントループ、ツール実行、デフォルト compact | — |

## 依存関係

| ブロッカー | 本リポジトリへの影響 |
|---|---|
| [#291](https://github.com/otolab/modular-prompt/issues/291) P0 | `abort.test.ts` 合格には必須。それまではクライアント側打ち切りのみ |
| [#291](https://github.com/otolab/modular-prompt/issues/291) P1 | `tokens.test.ts` の usage が空にならないようにする |
| [#291](https://github.com/otolab/modular-prompt/issues/291) P2 | `cacheRead` / `cacheWrite` を 0 以外で埋められる |
| [#254](https://github.com/otolab/modular-prompt/issues/254) | abort 実装時にプロセス死活と整合確認 |

## マイルストーン

### M1: Hello MLX

- 固定モデル 1 つ、`streamSimple`、usage マッピング（driver が返す範囲）
- `pi install` でロード確認

### M2: エージェントとして動く

- tool call、`getCapabilities` によるモデル一覧
- `session_shutdown`

### M3: 長セッション・品質

- compact、overflow リライト、増分パーサ
- #291 後: `abort.test.ts`

### M4: 配布

- pi-ai テストスイート（可能な範囲）、npm publish
