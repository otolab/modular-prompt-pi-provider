# modular-prompt 側 API（消費のみ）

本拡張が **呼び出すだけ** の API。実装は [modular-prompt](https://github.com/otolab/modular-prompt) の `@modular-prompt/driver` **0.14.0+**。

詳細は [DRIVER_API.md](https://github.com/otolab/modular-prompt/blob/main/docs/DRIVER_API.md) を参照。

## 本拡張の接続方針

**`MlxDriver` を直接インスタンス化しない。** 次の経路で接続する。

```typescript
import { AIService, type ApplicationConfig } from "@modular-prompt/driver";

const config: ApplicationConfig = {
  models: [
    {
      model: "mlx-community/gemma-4-26B-A4B-it-heretic-4bit",
      provider: "mlx",
      capabilities: ["streaming", "local", "chat", /* ... */],
    },
  ],
};

const service = new AIService(config);
const driver = await service.createDriver(config.models![0]!);
// driver: AIDriver
```

| コンポーネント | 本リポジトリでの役割 |
|---|---|
| `ApplicationConfig` | `src/config.ts` — モデル一覧・デフォルトオプション |
| `AIService` | `src/driver/service.ts` — ファクトリ登録済みサービス |
| `AIDriver` | `src/driver/pool.ts` — `streamQuery` / `close` のみ使用 |
| `ModelSpec` | Pi `Model.id` と一致させる（`model` フィールド） |

MLX 固有の `MlxCacheController` 等は `ModelSpec.driverOptions` 経由（P1 以降で検討）。

## `AIDriver`（共通インターフェイス）

```typescript
interface AIDriver {
  query(prompt: CompiledPrompt, options?: QueryOptions): Promise<QueryResult>;
  streamQuery(prompt: CompiledPrompt, options?: QueryOptions): Promise<StreamResult>;
  close(): Promise<void>;
}
```

本拡張の主経路は **`streamQuery`**。`close()` はプール切替・`session_shutdown`（P1）で呼ぶ。

MLX 実装の詳細（`getCapabilities`、Python 子プロセス）は `MlxDriver` 内部。P1 の discovery で利用予定。

## `streamQuery` 戻り値

`StreamResult` は driver 共通の形のまま（[scope.md](./scope.md) 参照）。

```typescript
interface StreamResult {
  stream: AsyncIterable<string>;  // 生テキスト（タグ含む）
  result: Promise<QueryResult>;
}
```

### `QueryResult`（`result` 解決後）

```typescript
interface QueryResult {
  content: string;
  thinkingContent?: string;
  toolCalls?: ToolCall[];
  finishReason?: 'stop' | 'length' | 'error' | 'tool_calls';
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;        // promptTokens + completionTokens（cache 系は含まない）
    cacheReadTokens?: number;
    cacheWriteTokens?: number;
  };
  errors?: LogEntry[];
}
```

### ストリームの扱い

1. **`stream` はテキストのみ** — thinking タグ・tool call デリミタを含む生出力
2. **`thinkingContent` / `toolCalls` は `result` 後処理** — driver 内の `selectResponseProcessor`
3. **usage は `result` のみ** — ストリームチャンクには含まれない

Pi の `thinking_*` / `toolcall_*` リアルタイム化は本拡張の [増分パーサ](./streaming.md) で行う（P2）。M1 は生 `text_delta`。

## `QueryOptions` マッピング

| Pi `SimpleStreamOptions` | `QueryOptions` | 備考 |
|---|---|---|
| `temperature` | `temperature` | |
| `maxTokens` | `maxTokens` | |
| `reasoning` 未指定 | `mode` 省略 or default | |
| `reasoning: "low"\|"medium"\|"high"` | `mode: 'thinking'`, `reasoningEffort` | MLX のみ |
| `signal` | `signal` | MLX で対応。キャンセル判定は `signal.aborted` |
| — | `stream: true` | 固定 |
| — | `tools` | `Context.tools` から変換（P1） |
| — | `cache: true` | `MlxCacheController` 利用時（P1） |

### abort 時の driver 契約

| driver | 意味 |
|---|---|
| `finishReason: 'error'` | キャンセル含むエラー終了 |
| `signal.aborted === true` | キャンセル（本拡張が Pi `"aborted"` に変換） |
| `result` | reject しない |
| `content` | キャンセル前の部分応答を保持 |

## 共通ヘルパー

`@modular-prompt/driver` から export。本拡張で利用:

| 関数 | 用途 |
|---|---|
| `isAborted` | `stream-bridge` でループ打ち切り |
| `watchAbortSignal` | 参照用（将来） |
| `createAbortedStreamResult` | 参照用（即時 abort） |
| `buildQueryUsage` | 参照用 |

## `CompiledPrompt`（アダプタが組み立てる）

型は `@modular-prompt/core`。driver は **`CompiledPrompt` のみ** 受け付ける。

エージェント用途のマッピングは [adapter.md](./adapter.md)。

## `getCapabilities()` → モデル登録（P1）

M1 は `ApplicationConfig` に固定 `ModelSpec` を登録。P1 で `MlxDriver.getCapabilities()` の結果を `ModelSpec` / Pi `models` に反映する。

`streamFromMessages` は driver に追加しない（変換は本拡張の責務）。
