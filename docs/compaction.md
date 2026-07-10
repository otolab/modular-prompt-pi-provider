# Compaction と overflow 回復

長セッションではコンテキストウィンドウ超過が発生する。Pi は自動 compact + リトライを持つが、**MLX 独自のエラー文字列** と **要約 Prompt** は本拡張で扱う。

参照: [compaction.md](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/compaction.md)

## 2 つの仕組み

| 仕組み | API | 役割 |
|---|---|---|
| **overflow 検知** | `message_end` | エラー文字列を Pi 既知パターンにリライト → 自動 compact トリガ |
| **要約生成** | `session_before_compact` | compact 時の **summary 本文** を本拡張の Prompt で生成 |

どちらも `streamSimple` とは別 API。

## overflow リライト（`message_end`）

Pi は `errorMessage` が既知パターン（`context_length_exceeded` 等）にマッチすると:

1. 失敗した assistant メッセージを破棄
2. 履歴を compact
3. 1 回リトライ

MLX のエラーはパターンにマッチしないことが多い。

```typescript
const MLX_OVERFLOW = /maximum sequence length|context.*exceed|too many tokens/i;

pi.on("message_end", (event, ctx) => {
  const message = event.message;
  if (message.role !== "assistant") return;
  if (message.stopReason !== "error") return;
  if (message.provider !== PROVIDER_ID && ctx.model?.provider !== PROVIDER_ID) return;

  const err = message.errorMessage ?? "";
  if (err.includes("context_length_exceeded")) return;
  if (!MLX_OVERFLOW.test(err)) return;

  return {
    message: {
      ...message,
      errorMessage: `context_length_exceeded: ${err}`,
    },
  };
});
```

### 注意

- **コンテキスト超過のみ** リライトする
- レートリミット・一時障害を誤って `context_length_exceeded` にすると **不可逆な compact** が走る

## カスタム compact（`session_before_compact`）

```typescript
pi.on("session_before_compact", async (event, ctx) => {
  const { preparation, reason, willRetry, signal } = event;

  // preparation: 保持するエントリ境界など
  // reason: "manual" (/compact) | "threshold" | "overflow"
  // willRetry: overflow 回復後にリトライするか

  const summary = await generateCompactionSummary({
    entries: preparation.entriesToSummarize,  // 実際のフィールド名は Pi 型に合わせる
    model: ctx.model,
    signal,
  });

  return {
    compaction: {
      summary,
      firstKeptEntryId: preparation.firstKeptEntryId,
      tokensBefore: preparation.tokensBefore,
    },
  };
});
```

### 要約 Prompt の置き場所

```
src/prompts/
  compaction.ts      # 要約用 system / user テンプレート
  compaction-mlx.ts  # MLX 向け調整（thinking 除去指示など）
```

`CompiledPrompt` 組み立てと同様、**本拡張の資産**として管理する。modular-prompt 本体には入れない。

### 要約の実行経路

compact 用要約も MLX で回すなら:

1. `session_before_compact` 内で **別の短い `streamQuery`**（または軽量モデル）
2. 要約専用 `CompiledPrompt` を `prompts/compaction.ts` から組み立て
3. `signal` でキャンセル連携

エージェント本番と同じ `MlxDriver` インスタンスを使うか、要約用に別モデルを使うかは設定で切り替え可能にする。

## `session_compact`

compact 完了後のフック。ログ・メトリクス用。

```typescript
pi.on("session_compact", (event, ctx) => {
  // event.reason, event.willRetry, event.fromExtension
});
```

## `context` イベント（任意）

LLM 呼び出し直前に messages を剪定する軽量な前処理。compact とは別レイヤ。

```typescript
pi.on("context", async (event, ctx) => {
  if (ctx.model?.provider !== PROVIDER_ID) return;
  // event.messages は deep copy — 安全に加工可
  return { messages: pruneOldToolOutputs(event.messages) };
});
```

## 関連ファイル（予定）

| ファイル | 内容 |
|---|---|
| `src/hooks/overflow-rewrite.ts` | `message_end` 登録 |
| `src/hooks/compaction.ts` | `session_before_compact` 登録 |
| `src/prompts/compaction.ts` | 要約 Prompt テンプレート |
