# アダプタ層（型変換）

Pi の `Context` と modular-prompt の `CompiledPrompt` / `QueryOptions` の橋渡し。本リポジトリの `src/adapter/` に実装する。

## モジュール構成（予定）

| ファイル | 関数 |
|---|---|
| `context-to-prompt.ts` | `piContextToCompiledPrompt(context)` |
| `message-mapper.ts` | Pi `Message` ↔ `MessageElement` |
| `tools.ts` | `piToolsToToolDefinitions(tools)` |
| `options.ts` | `piOptionsToQueryOptions(options, model)` |
| `usage.ts` | `mapQueryResultUsageToPi(result, model)` |
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

modular-prompt では **2 層** に分かれる（混同しないこと）:

| 層 | 用途 | 例 |
|---|---|---|
| `ModelSpec.defaultOptions` | `MlxDriver.defaultOptions` → **Python 生成パラメータ** | `maxTokens`, `temperature`, `topP` |
| `QueryOptions`（`streamQuery` 引数） | 実行時オプション | `reasoningEffort`, `stream`, `signal` |

`mode` は **指定しない**（MLX は apiStrategy auto + chat template で API 選択）。Pi の `reasoning` は `reasoningEffort` にマップする。

```typescript
function piOptionsToQueryOptions(
  options: SimpleStreamOptions | undefined,
  model: Model,
): QueryOptions {
  const reasoningEffort =
    options?.reasoning === "low" ||
    options?.reasoning === "medium" ||
    options?.reasoning === "high"
      ? options.reasoning
      : undefined;

  return {
    stream: true,
    temperature: options?.temperature,
    maxTokens: options?.maxTokens,
    reasoningEffort,
    signal: options?.signal,
  };
}
```

`ModelSpec.defaultOptions` に `mode` を入れないこと（`pickMlxDriverDefaultOptions` でフィルタ）。実装は `src/driver/mlx-options.ts`。

`Context.tools` は `streamQuery` 呼び出し時に別途 `tools: piToolsToToolDefinitions(context.tools)` で渡す。

## finishReason マッピング

| `QueryResult.finishReason` | 条件 | Pi `stopReason` | 終了イベント |
|---|---|---|---|
| `'stop'` | | `"stop"` | `done` |
| `'length'` | | `"length"` | `done` |
| `'tool_calls'` | | `"toolUse"` | `done` |
| `'error'` | `signal.aborted` | `"aborted"` | `error` (`reason: "aborted"`) |
| `'error'` | それ以外 | `"error"` | `error` |

## usage マッピング

driver の `result.usage` を Pi の `Usage` に変換する。`promptTokens` はプロバイダ生値であり、Pi の `input` とは別物。

```typescript
function mapQueryResultUsageToPi(
  result: QueryResult,
  model: Model,
): Usage {
  const promptTokens = result.usage?.promptTokens ?? 0;
  const completionTokens = result.usage?.completionTokens ?? 0;
  const cacheRead = result.usage?.cacheReadTokens ?? 0;
  const cacheWrite = result.usage?.cacheWriteTokens ?? 0;
  const input = Math.max(0, promptTokens - cacheRead - cacheWrite);

  const usage: Usage = {
    input,
    output: completionTokens,
    cacheRead,
    cacheWrite,
    totalTokens: input + completionTokens + cacheRead + cacheWrite,
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
  };
  calculateCost(model, usage);
  return usage;
}
```

### いつ `output.usage` を更新するか

driver の `stream` には usage がない。`await result` で得たあと、`done` / `error` を push する直前に `output.usage` を上書きする。それ以前の `partial` は 0 のままでよい。

abort 時は `result` に載った usage をそのまま使う。driver 0.14.0+ の MLX は meta から `usage` を返す。

**注意**: driver の `totalTokens` は `promptTokens + completionTokens` のみ。Pi の `totalTokens` は本拡張で `input + output + cacheRead + cacheWrite` とする（`result.usage.totalTokens` をそのまま使わない）。

| driver `result.usage` | Pi `Usage` |
|---|---|
| `promptTokens` | `input` 算出の元（そのまま `input` にしない） |
| `completionTokens` | `output` |
| `cacheReadTokens` | `cacheRead` |
| `cacheWriteTokens` | `cacheWrite` |

## `stream-bridge` 概要

[streaming.md](./streaming.md) 参照。疑似コード:

```typescript
async function bridgeDriverStreamToPi(
  driver: AIDriver,
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
      if (options?.signal?.aborted) break;
      parser.push(chunk);
    }

    const final = await result;
    output.usage = mapQueryResultUsageToPi(final, model);
    parser.finalizeFromResult(final);

    if (options?.signal?.aborted) {
      piStream.push({ type: "error", reason: "aborted", error: output });
    } else if (final.finishReason === "error") {
      piStream.push({ type: "error", reason: "error", error: output });
    } else {
      piStream.push({ type: "done", reason: mapStopReason(final.finishReason), message: output });
    }
    piStream.end();
  } catch (e) {
    // error イベント
  }
}
```
