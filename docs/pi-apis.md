# Pi 拡張 API

本拡張が使う Pi 側の API。`streamSimple` だけでなく **イベントフック** が重要。

参照: [extensions.md](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/extensions.md), [custom-provider.md](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/custom-provider.md)

## ExtensionAPI エントリ

```typescript
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default async function (pi: ExtensionAPI): Promise<void> {
  // 1. モデル discovery（任意: async ファクトリ内）
  // 2. pi.registerProvider(...)
  // 3. pi.on(...) フック登録
}
```

| 要件 | 理由 |
|---|---|
| `export default` ファクトリ | jiti が TS を直接ロード |
| `async` 可 | 起動前にモデル一覧を確定（`pi --list-models` 含む） |
| ファクトリ内で MLX 起動しない | session なし invocation があり得る |

## `pi.registerProvider(name, config)`

拡張から差し替え可能なカスタム実装は **`streamSimple` のみ**。内蔵の `stream` は pi-ai 内部用。

### 本拡張で使うフィールド

```typescript
pi.registerProvider("modular-prompt-mlx", {
  name: "Modular Prompt MLX",
  api: "modular-prompt-mlx",
  streamSimple: streamModularPromptMlx,
  models: ProviderModelConfig[],
});
```

| フィールド | 必須 | MLX 直結 |
|---|---|---|
| `api` | ✅ | 独自 ID |
| `streamSimple` | ✅ | 通信本体 |
| `models` | ✅ | `getCapabilities()` から構築 |
| `baseUrl` / `apiKey` / `headers` | ❌ | HTTP 不要 |
| `oauth` | ❌ | ローカル |
| `compat`（モデル側） | 任意 | Qwen 等は driver 側 `QueryOptions` に寄せる |

### 使わないパターン

- `api: "openai-completions"` + `streamSimple` なし → 内蔵 HTTP ストリーマ（Ollama 等向け）
- `baseUrl` のみ上書き → プロキシ向け

## `streamSimple` 契約

```typescript
function streamModularPromptMlx(
  model: Model<"modular-prompt-mlx">,
  context: Context,
  options?: SimpleStreamOptions,
): AssistantMessageEventStream;
```

- 戻り値: `createAssistantMessageEventStream()` で生成
- 失敗: **throw せず** `{ type: "error", ... }` を push
- abort: `options?.signal?.aborted` → `stopReason: "aborted"`

詳細イベント列は [streaming.md](./streaming.md)。

### 入力 `Context`

```typescript
interface Context {
  systemPrompt?: string;
  messages: Message[];  // UserMessage | AssistantMessage | ToolResultMessage
  tools?: Tool[];
}
```

### 入力 `SimpleStreamOptions`（抜粋）

| フィールド | アダプタでの扱い |
|---|---|
| `temperature`, `maxTokens` | `QueryOptions` へ |
| `reasoning` | `mode` / `reasoningEffort` へ |
| `signal` | MLX abort（driver 0.14.0+） |
| `sessionId`, `cacheRetention` | 将来: `MlxCacheController` 連携 |
| `onPayload`, `onResponse` | HTTP 用。MLX 直結では未使用 |

## イベントフック（`pi.on`）

### 必須〜推奨

| イベント | 用途 | 優先度 |
|---|---|---|
| **`session_start`** | ドライバプール初期化のトリガ | P1 |
| **`session_shutdown`** | `AIDriver.close()`（プール経由） | P1 |
| **`message_end`** | overflow エラーの `errorMessage` リライト | P2 |
| **`session_before_compact`** | **カスタム compact 要約**（専用 Prompt） | P1 |
| `session_compact` | compact 完了ログ・メトリクス | P3 |

### 任意

| イベント | 用途 |
|---|---|
| **`context`** | LLM 呼び出し直前の `messages` 加工（フィルタ・剪定） |
| `before_agent_start` | ターン単位の system prompt 追記 |
| `model_select` | モデル切替時のドライバ切替 |
| `thinking_level_select` | reasoning レベル変更の通知 |

### HTTP プロバイダ専用（本拡張では基本不要）

| イベント | 理由 |
|---|---|
| `before_provider_headers` | HTTP ヘッダー組み立て後 |
| `before_provider_request` | シリアライズ済み payload |
| `after_provider_response` | HTTP レスポンス |

`streamSimple` カスタム実装では HTTP レイヤがないため発火しないか、意味が薄い。

### compact 関連（詳細は [compaction.md](./compaction.md)）

```typescript
pi.on("session_before_compact", async (event, ctx) => {
  const { preparation, reason, willRetry, signal } = event;
  // reason: "manual" | "threshold" | "overflow"

  return {
    compaction: {
      summary: "...",  // 本拡張の Prompt で生成
      firstKeptEntryId: preparation.firstKeptEntryId,
      tokensBefore: preparation.tokensBefore,
    },
  };
  // または return { cancel: true };
});
```

## その他 ExtensionAPI（本件では非中心）

| API | 用途 |
|---|---|
| `pi.registerTool` | カスタムツール |
| `pi.registerCommand` | `/command` |
| `pi.unregisterProvider` | 動的解除 |
| `pi.sendMessage` / `sendUserMessage` | メッセージ注入 |

コーディングエージェントの標準ツール（read/write/edit/bash）は Pi 内蔵のため、プロバイダ拡張では触らない。

## `ProviderModelConfig`（モデル登録）

```typescript
{
  id: string,           // MLX モデル名と一致させる
  name: string,
  reasoning: boolean,
  input: ("text" | "image")[],
  cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
  contextWindow: number,  // getCapabilities().features.modelMaxLength
  maxTokens: number,
}
```

VLM モデルは `input` に `"image"` を含める。
