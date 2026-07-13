# AbortSignal 要求仕様

Pi の `streamSimple` に渡される `signal` の振る舞い要求。pi-ai の型に依存せず、**キャンセルハンドル**として実装する。

参照:

- [Pi abort.test.ts](https://github.com/earendil-works/pi/blob/main/packages/ai/test/abort.test.ts)
- [Pi ai README — Aborting Requests](https://github.com/earendil-works/pi/blob/main/packages/ai/README.md)
- [modular-prompt#291](https://github.com/otolab/modular-prompt/issues/291)

## 目的

ユーザーが **Esc** 等で応答をキャンセルしたとき、LLM 推論を止め、部分応答を保持したまま `"aborted"` で終了する。

Pi エージェントはターンごとに `AbortController` を作り、`streamSimple(model, context, { signal })` へ渡す（[`agent-loop.ts`](https://github.com/earendil-works/pi/blob/main/packages/agent/src/agent-loop.ts)）。

## キャンセルハンドルの最小契約

Web 標準 [`AbortSignal`](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal) と同等でよい。

| 能力 | 用途 |
|---|---|
| `aborted: boolean` | 呼び出し時点で既にキャンセル済みか |
| `addEventListener("abort", fn)` | ストリーム中のキャンセル検知 |
| `removeEventListener`（任意） | リスナー解除 |

## `streamSimple` 実装者への契約

| # | 要求 |
|---|---|
| 1 | **`streamSimple` は throw しない** — キャンセルもストリームの `error` イベントで返す |
| 2 | **キャンセル時の `stopReason` は `"aborted"`** — `"error"` ではない |
| 3 | **`result()` は reject しない** — 最終 `AssistantMessage` を resolve |
| 4 | **部分 `content` を保持** — キャンセル前に出たテキストは捨てない |
| 5 | **バックエンドの生成を止める** — TS 側ループ打ち切りだけでは不十分（MLX は driver 連携） |

### ストリーム終了形

内蔵プロバイダ（[`openai-completions.ts`](https://github.com/earendil-works/pi/blob/main/packages/ai/src/api/openai-completions.ts)）に倣う:

```typescript
output.stopReason = signal?.aborted ? "aborted" : "error";
stream.push({ type: "error", reason: output.stopReason, error: output });
stream.end();
```

正常終了は `{ type: "done", ... }`。キャンセルは **`error` + `reason: "aborted"`**。

## テストシナリオ（`abort.test.ts`）

### A. 即時キャンセル（`testImmediateAbort`）

```
controller.abort() を stream 呼び出し前に実行
→ stopReason === "aborted"
→ content は空でもよい
→ throw しない
```

### B. 途中キャンセル（`testAbortSignal`）

```
50 文字程度受信後に controller.abort()
→ stopReason === "aborted"
→ content.length > 0
→ 同一 context で follow-up complete() が stopReason === "stop" で成功
```

### C. 空応答キャンセル後の継続（`testAbortThenNewMessage`）

```
即 abort → content 空の assistant を context に載せる
→ 次 user メッセージ → complete() 成功
```

## `"aborted"` と `"error"` の違い

| | `aborted` | `error` |
|---|---|---|
| 原因 | ユーザー操作（Esc 等） | API 障害・推論エラー |
| エージェントループ | ターン終了（ツール実行しない） | 同左 |
| 次ターン | 続行可能 | 続行可能 |
| overflow compact | トリガしない | 場合による |

## 責務分担

```
Pi Agent                    pi-provider-ext                 @modular-prompt/driver
────────                    ───────────────                 ────────────────────
AbortController.abort()  →  streamSimple が検知         →  QueryOptions.signal
                         →  Pi イベント変換              →  Python 推論キャンセル
                         →  for-await 打ち切り           →  ストリーム destroy
```

| レイヤ | 最低限（アダプタのみ） | 理想（#291 後） |
|---|---|---|
| アダプタ | `signal.aborted` 監視、ループ打ち切り、`aborted` で終了 | `signal` を driver に渡す |
| MlxDriver | — | `QueryOptions.signal` 受け取り |
| MlxProcess | — | 進行中リクエストのキャンセル、次リクエストに影響しない |

**TS 側だけ止めて Python が走り続ける** と次リクエストのハング・GPU 占有の原因になる（[#254](https://github.com/otolab/modular-prompt/issues/254) との整合も要確認）。

## アダプタ実装スケッチ

```typescript
function watchAbort(
  signal: AbortSignal | undefined,
  onAbort: () => void,
): () => void {
  if (!signal) return () => {};
  if (signal.aborted) {
    onAbort();
    return () => {};
  }
  const handler = () => onAbort();
  signal.addEventListener("abort", handler);
  return () => signal.removeEventListener("abort", handler);
}

// stream-simple 内
const cleanup = watchAbort(options?.signal, () => {
  cancelled = true;
  // driver.cancel() — #291 実装後
});

for await (const chunk of stream) {
  if (cancelled || options?.signal?.aborted) break;
  parser.push(chunk);
}
```

## driver 側

[modular-prompt#291](https://github.com/otolab/modular-prompt/issues/291) は `@modular-prompt/driver` 0.14.0 で対応済み。本拡張は `signal` 伝播と Pi 向け変換を実装する。

## 実装チェックリスト（本拡張）

- [ ] 即時 `aborted` → `stopReason: "aborted"`、空 content 可
- [ ] 途中 `abort` → 部分 content 保持
- [ ] `error` イベント `reason: "aborted"` で終了
- [ ] `result()` resolve（reject しない）
- [ ] キャンセル後の次ターンが動作
- [x] driver `signal` 連携（driver 0.14.0+）
