# modular-prompt 側 API（消費のみ）

本拡張が **呼び出すだけ** の API。実装・変更は [modular-prompt](https://github.com/otolab/modular-prompt) 側。

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
    totalTokens: number;
    cacheReadTokens?: number;   // #291 P2 以降
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
| `signal` | `signal`（#291 P0 以降） | 現状未対応 |
| — | `stream: true` | 固定 |
| — | `tools` | `Context.tools` から変換 |
| — | `cache: true` | `MlxCacheController` 利用時 |

## `CompiledPrompt`（アダプタが組み立てる）

driver は **`CompiledPrompt` のみ** 受け付ける。`ChatMessage[]` 直接 API は作らない（本拡張で変換）。

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

## driver 側の未実装（[#291](https://github.com/otolab/modular-prompt/issues/291)）

| 項目 | 優先度 |
|---|---|
| `QueryOptions.signal` | P0 |
| MLX `result.usage` の充足 | P1 |
| `cacheReadTokens` / `cacheWriteTokens` | P2 |

`streamFromMessages` は作らない（変換は本拡張の責務）。
