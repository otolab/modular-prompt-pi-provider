# modular-prompt 側 API（消費のみ）

本拡張が **呼び出すだけ** の API。実装は [modular-prompt](https://github.com/otolab/modular-prompt) の `@modular-prompt/driver` **0.14.0+**。

詳細は [DRIVER_API.md](https://github.com/otolab/modular-prompt/blob/main/docs/DRIVER_API.md) を参照。

## `MlxDriver`

```typescript
import { MlxDriver, MlxCacheController } from "@modular-prompt/driver";

const driver = new MlxDriver({
  model: "mlx-community/Qwen3-Coder-30B-A3B-Instruct-4bit",
  cacheController?: new MlxCacheController({ cacheDir: "..." }),
  defaultOptions?: { ... },
});
```

### メソッド

| メソッド | 用途 |
|---|---|
| **`streamQuery(prompt, options?)`** | 本拡張の主経路 |
| `query(prompt, options?)` | 内部で stream を消費。直接は使わない |
| **`getCapabilities()`** | モデル discovery |
| **`close()`** | セッション終了時 |

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

Pi の `thinking_*` / `toolcall_*` リアルタイム化は本拡張の [増分パーサ](./streaming.md) で行う。

## `QueryOptions` マッピング

| Pi `SimpleStreamOptions` | `QueryOptions` | 備考 |
|---|---|---|
| `temperature` | `temperature` | |
| `maxTokens` | `maxTokens` | |
| `reasoning: "off"` | `mode: 'default'` | |
| `reasoning: "low"\|"medium"\|"high"` | `mode: 'thinking'`, `reasoningEffort` | MLX のみ |
| `signal` | `signal` | MLX で対応。キャンセル判定は `signal.aborted` |
| — | `stream: true` | 固定 |
| — | `tools` | `Context.tools` から変換 |
| — | `cache: true` | `MlxCacheController` 利用時 |

### abort 時の driver 契約

| driver | 意味 |
|---|---|
| `finishReason: 'error'` | キャンセル含むエラー終了 |
| `signal.aborted === true` | キャンセル（本拡張が Pi `"aborted"` に変換） |
| `result` | reject しない |
| `content` | キャンセル前の部分応答を保持 |

## 共通ヘルパー（参照用）

`@modular-prompt/driver` から export される。本拡張は主に自前マッピングを使うが、挙動の参照に使える。

| 関数 | 用途 |
|---|---|
| `buildQueryUsage` | 生トークン数 → `QueryResult.usage` |
| `watchAbortSignal` | `AbortSignal` リスナー |
| `createAbortedStreamResult` | 即時 abort 用の空 `StreamResult` |
| `isAborted` | `signal?.aborted` の短縮 |

## `CompiledPrompt`（アダプタが組み立てる）

driver は **`CompiledPrompt` のみ** 受け付ける。

```typescript
interface CompiledPrompt {
  instructions: Element[];
  data: Element[];
  output: Element[];
  metadata?: { outputSchema?: object };
}
```

エージェント用途のマッピングは [adapter.md](./adapter.md)。

## `getCapabilities()` → モデル登録

```typescript
interface MlxModelCapabilities {
  methods: string[];
  features: {
    hasChatTemplate: boolean;
    modelMaxLength?: number;  // → contextWindow
    chatTemplate?: {
      toolCallFormat?: { ... };  // native tool 対応判定
    };
  };
  chatRestrictions?: { ... };
}
```

`streamFromMessages` は driver に追加しない（変換は本拡張の責務）。
