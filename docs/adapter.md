# アダプタ層（型変換）

Pi の `Context` と modular-prompt の `CompiledPrompt` / `QueryOptions` の橋渡し。本リポジトリの `src/adapter/` に実装する。

## モジュール構成（予定）

| ファイル | 関数 |
|---|---|
| `context-to-prompt.ts` | `piContextToCompiledPrompt(context)` |
| `message-mapper.ts` | Pi `Message` ↔ `MessageElement` |
| `tools.ts` | `piToolsToToolDefinitions(tools)` |
| `options.ts` | `piOptionsToQueryOptions(options, model)` |
| `stream-bridge.ts` | `bridgeMlxStreamToPi(...)` |
| `finish-reason.ts` | `mapFinishReason(...)` |

## `Context` → `CompiledPrompt`

```typescript
function piContextToCompiledPrompt(context: Context): CompiledPrompt {
  return {
    instructions: context.systemPrompt
      ? [{ type: "text", content: context.systemPrompt }]
      : [],
    data: context.messages.flatMap(piMessageToElements),
    output: [],
  };
}
```

| Pi | `CompiledPrompt` |
|---|---|
| `systemPrompt` | `instructions` の `text` 要素 |
| `messages` | `data` の `MessageElement[]` |
| `tools` | `streamQuery` の `QueryOptions.tools` へ（Prompt には含めない） |

`output` は空。Pi エージェントは structured output スキーマを要求しない。

### formatter の preamble

`formatPromptAsMessages` はデフォルトで Instructions/Data/Output の preamble を付ける。エージェント会話では:

- **案 A**: デフォルト formatter をそのまま使う（modular-prompt 慣習に沿う）
- **案 B**: `FormatterOptions.preamble: undefined` + section ヘッダ最小化

初版は **案 A** で動作確認し、トークン消費が問題なら案 B。

## メッセージ変換

### Pi → `MessageElement`

| Pi 型 | 変換 |
|---|---|
| `UserMessage` (string) | `{ type:'message', role:'user', content }` |
| `UserMessage` (画像配列) | `{ type:'message', role:'user', content: Attachment[] }` |
| `AssistantMessage` (text) | `{ type:'message', role:'assistant', content: 結合テキスト }` |
| `AssistantMessage` (toolCall blocks) | `{ type:'message', role:'assistant', content:'', toolCalls }` |
| `AssistantMessage` (thinking blocks) | 履歴再送時は text 化するか省略（モデル依存） |
| `ToolResultMessage` | `{ type:'message', role:'tool', toolCallId, name, kind, value }` |

### フィールド差異

| Pi | modular-prompt |
|---|---|
| `role: "toolResult"` | `role: "tool"` |
| `toolName` | `name` |
| `isError: true` | `kind: 'error'` |
| `content: TextContent[]` | `value`（文字列 or JSON） |

### Tool call 引数

Pi `ToolCall.arguments` と mp `ToolCall.arguments` は同形状（`Record<string, unknown>`）。

## `Tool` → `ToolDefinition`

```typescript
function piToolsToToolDefinitions(tools: Tool[]): ToolDefinition[] {
  return tools.map((t) => ({
    name: t.name,
    description: t.description,
    parameters: t.parameters as Record<string, unknown>,  // typebox → JSON Schema
  }));
}
```

## `SimpleStreamOptions` → `QueryOptions`

```typescript
function piOptionsToQueryOptions(
  options: SimpleStreamOptions | undefined,
  model: Model,
): QueryOptions {
  const q: QueryOptions = {
    stream: true,
    temperature: options?.temperature,
    maxTokens: options?.maxTokens,
  };

  const level = options?.reasoning ?? "off";
  if (level !== "off") {
    q.mode = "thinking";
    if (level === "low" || level === "medium" || level === "high") {
      q.reasoningEffort = level;
    }
  }

  // signal: #291 実装後
  // if (options?.signal) q.signal = options.signal;

  return q;
}
```

`Context.tools` は `streamQuery` 呼び出し時に別途 `tools: piToolsToToolDefinitions(context.tools)` で渡す。

## finishReason マッピング

| `QueryResult.finishReason` | Pi `stopReason` | `done.reason` |
|---|---|---|
| `'stop'` | `"stop"` | `"stop"` |
| `'length'` | `"length"` | `"length"` |
| `'tool_calls'` | `"toolUse"` | `"toolUse"` |
| `'error'` | `"error"` | — (`error` イベント) |

## usage マッピング

```typescript
output.usage.input = result.usage?.promptTokens ?? 0;
output.usage.output = result.usage?.completionTokens ?? 0;
output.usage.cacheRead = 0;   // 将来 MLX meta から
output.usage.cacheWrite = 0;
calculateCost(model, output.usage);
```

## `stream-bridge` 概要

[streaming.md](./streaming.md) 参照。疑似コード:

```typescript
async function bridgeMlxStreamToPi(
  driver: MlxDriver,
  model: Model,
  context: Context,
  options: SimpleStreamOptions | undefined,
  piStream: AssistantMessageEventStream,
): Promise<void> {
  const output = createInitialAssistantMessage(model);
  piStream.push({ type: "start", partial: output });

  try {
    const prompt = piContextToCompiledPrompt(context);
    const queryOpts = {
      ...piOptionsToQueryOptions(options, model),
      tools: context.tools ? piToolsToToolDefinitions(context.tools) : undefined,
    };

    const { stream, result } = await driver.streamQuery(prompt, queryOpts);
    const parser = createIncrementalParser(output, piStream);

    for await (const chunk of stream) {
      if (options?.signal?.aborted) { /* abort 処理 */ break; }
      parser.push(chunk);
    }

    const final = await result;
    parser.finalizeFromResult(final);
    // done / error
  } catch (e) {
    // error イベント
  }
}
```
