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
  thinkingContent?: string;   // extractThinkingContent 後
  toolCalls?: ToolCall[];
  finishReason?: 'stop' | 'length' | 'error' | 'tool_calls';
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  errors?: LogEntry[];
}
```

### MLX ドライバのストリーム特性

1. **ストリーム中は生テキストのみ** — `<think>`, tool call デリミタを含む
2. **`thinkingContent` / `toolCalls` は `result` 後処理** — `selectResponseProcessor`（`mlx-driver.ts`）
3. **メタデータ** — ストリーム末尾 `\x1e__META__:` + JSON（token 数）

→ Pi の `thinking_*` / `toolcall_*` をリアルタイムに出すには、本拡張の [増分パーサ](./streaming.md) が必要。

## `QueryOptions` マッピング

| Pi `SimpleStreamOptions` | `QueryOptions` | 備考 |
|---|---|---|
| `temperature` | `temperature` | |
| `maxTokens` | `maxTokens` | |
| `reasoning: "off"` | `mode: 'default'` | |
| `reasoning: "low"\|"medium"\|"high"` | `mode: 'thinking'`, `reasoningEffort` | MLX のみ |
| `signal` | **未対応** | [#291](https://github.com/otolab/modular-prompt/issues/291) |
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

## 既知ギャップ（driver 側）

| 項目 | 状態 | 追跡 |
|---|---|---|
| `QueryOptions.signal` | 未実装 | [#291](https://github.com/otolab/modular-prompt/issues/291) |
| usage の cacheRead/cacheWrite | 未マッピング | 0 で返すか将来拡張 |
| 構造化ストリーム | なし | 本拡張の増分パーサで代替 |

`streamFromMessages` は **作らない**（変換・compact は本拡張の責務）。
