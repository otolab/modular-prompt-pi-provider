import type {
  AIDriver,
  QueryOptions,
  QueryResult,
  ToolCall,
} from "@modular-prompt/driver";
import type { CompiledPrompt } from "@modular-prompt/core";

/** workflow 共通入口（pi-provider 独自。sprite / process 型に依存しない） */
export interface WorkflowRequest {
  compiled: CompiledPrompt;
  queryOptions: QueryOptions;
}

/** ストリーミング workflow のハンドル */
export interface WorkflowStreamHandle {
  stream: AsyncIterable<string>;
  result: Promise<QueryResult>;
}

/** workflow 共通出口（非ストリーム経路向け） */
export type WorkflowResult =
  | {
      type: "response";
      text: string;
      queryResult: QueryResult;
    }
  | {
      type: "tool_calls";
      calls: ToolCall[];
      text?: string;
      queryResult: QueryResult;
    };

export interface PassthroughWorkflowContext {
  driver: AIDriver;
  request: WorkflowRequest;
  phase?: string;
}
