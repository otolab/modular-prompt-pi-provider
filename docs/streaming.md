# ストリーミングと増分パーサ

MLX ドライバは **生テキスト** を `AsyncIterable<string>` で返す。Pi は **チャンネル分離されたイベント** を要求する。ギャップは本拡張の増分パーサで埋める。

modular-prompt の Python から構造化チャンクを出す改修は **不要**（[architecture.md](./architecture.md)）。

## Pi が期待するイベント列

```
start
→ (text_start → text_delta* → text_end)*
→ (thinking_start → thinking_delta* → thinking_end)*
→ (toolcall_start → toolcall_delta* → toolcall_end)*
→ done | error
```

`contentIndex` はブロックごとにインクリメント。各イベントに `partial: AssistantMessage` を含める。

参照: [Pi custom-provider — Event Types](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/custom-provider.md)

## MLX 側の実態

Python `chat.py` はトークンをそのまま stdout へ:

```python
print(response.text, end="", flush=True)
```

完了後、TS 側で `extractThinkingContent` + `parseToolCalls` が一括実行される。

## 増分パーサの状態機械

```
                    ┌─────────────┐
    chunk ─────────►│   OUTSIDE   │─── 通常テキスト ───► text_delta
                    └──────┬──────┘
                           │ "<think>" 等を検出
                           ▼
                    ┌─────────────┐
                    │  IN_THINK   │─── チャンク ───► thinking_delta
                    └──────┬──────┘
                           │ "</think>" 等
                           ▼
                    ┌─────────────┐
                    │   OUTSIDE   │
                    └─────────────┘
```

### thinking について

| 質問 | 答え |
|---|---|
| 終端タグが見えるまで stream できない？ | **いいえ**。`thinking_delta` はブロック内チャンクを逐次出せる |
| 終端タグが必要なのは？ | `thinking_end` の区切りと、visible text への切り替え判断 |
| `text_delta` はいつ？ | thinking ブロックの **外** のテキストのみ |

### 対応するマーカー（`content-utils.ts` と同系）

| 形式 | 開始 | 終了 |
|---|---|---|
| Qwen 系 | `<think>` | `</think>` |
| Gemma-4 | `<\|channel>thought` | `<channel\|>` |

開始タグがチャンク境界で分割される場合はバッファで部分マッチを保持する。

### tool call

| 段階 | 方針 |
|---|---|
| **v1** | `result.toolCalls` 確定後に `toolcall_*` を一括発行 |
| **v2** | デリミタ検出後に `toolcall_delta` で JSON 断片を逐次 |

v1 でもエージェントは動くが、ツール呼び出し表示は応答完了まで遅れる。

## v1 と v2 の UX 比較

| 方式 | thinking | tool call | 実装コスト |
|---|---|---|---|
| 生ストリームを `text_delta` に流す | タグが UI に露出 | 同左 | 最低（不可） |
| `result` 待ち一括変換 | 完了後に表示 | 完了後に表示 | 低 |
| **増分パーサ（推奨）** | リアルタイム | v1: 完了後 / v2: リアルタイム | 中 |

## `result` との併用

増分パーサで text/thinking をリアルタイム化しつつ、`result` で:

- toolCalls の最終確定（パーサ漏れのフォールバック）
- usage / finishReason
- `errors` のログ

```typescript
const final = await result;
if (!parser.emittedToolCalls && final.toolCalls?.length) {
  emitToolCallsFromResult(final.toolCalls, output, piStream);
}
```

## abort

`options.signal` が abort されたら:

1. ストリーム消費を打ち切り
2. `stopReason: "aborted"` で `error` イベント
3. MLX 側キャンセルは [#291](https://github.com/otolab/modular-prompt/issues/291) 実装後に `driver` へ伝播

現状はクライアント側打ち切りのみでも Pi ループは進むが、`abort.test.ts` 合格には driver 連携が必要。
