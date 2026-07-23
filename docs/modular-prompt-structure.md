# modular-prompt 構造（pi-provider 向け）

Issue [#58](https://github.com/otolab/modular-prompt-pi-provider/issues/58)（汎用 Compact 機構）実装前の参照メモ。
upstream の [modular-prompt](https://github.com/otolab/modular-prompt) リポジトリ（`../modular-prompt`）を pi-provider からどう使うかを整理する。

既存の [modular-prompt-apis.md](./modular-prompt-apis.md) は **driver 消費 API** に限定。本書は **core / process / experiment を含む全体像** を扱う。

## レイヤ構成

modular-prompt は 4 層 + Process 層で考える（[ARCHITECTURE.md](https://github.com/otolab/modular-prompt/blob/main/docs/ARCHITECTURE.md) 準拠）。

```
┌─────────────────────────────────────────────┐
│  Application（pi-provider, sprite-claude 等）  │  ワークフロー選択・設定・ホスト API 橋渡し
├─────────────────────────────────────────────┤
│  Process（@modular-prompt/process）          │  streamProcess / agenticProcess 等
├─────────────────────────────────────────────┤
│  Module（PromptModule）                      │  静的テンプレート（objective, instructions, …）
├─────────────────────────────────────────────┤
│  Core（@modular-prompt/core）                │  merge / compile / 型
├─────────────────────────────────────────────┤
│  Driver（@modular-prompt/driver）            │  AIDriver.query / streamQuery
└─────────────────────────────────────────────┘
```

### 関心の分離（[CONCEPTS.md](https://github.com/otolab/modular-prompt/blob/main/docs/CONCEPTS.md)）

| 概念 | 役割 | 例 |
|---|---|---|
| **Module** | 何をするか（What）— 静的、再利用可能 | `streamProcessing`, ユーザーの compact 手順 module |
| **Context** | 何に対して（With What）— 実行時データ | `chunks`, `state`, Pi セッションから変換した入力 |
| **Driver** | どう実行するか（How） | `MlxDriver`, `DriverSet` |
| **Process** | どんな流れで（Workflow） | `streamProcess`, `agenticProcess` |

## パッケージ一覧

| パッケージ | 役割 | pi-provider での利用 |
|---|---|---|
| `@modular-prompt/core` | `PromptModule`, `merge`, `compile`, `CompiledPrompt` | アダプタ・compact strategy の module 定義 |
| `@modular-prompt/driver` | `AIDriver`, `AIService`, `QueryResult` | `model-registry` 経由で全 LLM 呼び出し |
| `@modular-prompt/process` | ワークフロー + プロセス用 PromptModule | **compact: `streamProcess`**、chat: `agenticProcess` |
| `@modular-prompt/utils` | Logger, Formatter 等 | 間接利用（process 内部） |
| `@modular-prompt/experiment` | モジュール比較・評価 CLI | 将来: compact strategy のオフライン検証 |

> **注意**: パッケージ名は `@modular-prompt/experiment`（`experimental` ではない）。

### ローカルリポジトリ構成（`../modular-prompt/packages/`）

```
packages/
  core/          # 型・merge・compile
  driver/        # 各プロバイダ実装・AIService・TestDriver
  process/       # workflows/ + modules/
  utils/         # 共通ユーティリティ
  experiment/    # YAML 駆動の比較実験
  simple-chat/   # サンプルアプリ（pi-provider 非依存）
```

## 基本処理フロー

```
PromptModule（静的）
    + Context（動的）
        ↓ merge（任意・process が内部で実施することも多い）
        ↓ compile()
CompiledPrompt
        ↓ driver.query() / streamQuery()
QueryResult
```

ワークフロー関数を使う場合、アプリ側は **ユーザ module + context** を渡し、process 層が `merge(streamProcessing, userModule)` や反復実行を担当する。

## Core: PromptModule

[skills/prompt-writing/SKILL.md](https://github.com/otolab/modular-prompt/blob/main/skills/prompt-writing/SKILL.md) が実務向けの要約。

### セクション分類

| 系 | セクション | 用途 |
|---|---|---|
| Instructions | `objective`, `persona`, `terms`, `methodology`, `instructions`, `guidelines` | AI への指示 |
| Data | `state`, `materials`, `inputs`, `chunks`, `messages` | 処理対象データ |
| Output | `schema`, `cue` | 出力形式 |

Instructions と Data を分離することで、ユーザー入力中の「指示っぽい文言」を Data として扱い、プロンプトインジェクションを抑える。

### DynamicContent

セクション要素は `(ctx) => string | string[] | Element | null` で実行時生成できる。`compile(module, context)` 時に評価される。

## Process: ワークフロー関数

[PROCESS_MODULE_GUIDE.md](https://github.com/otolab/modular-prompt/blob/main/docs/PROCESS_MODULE_GUIDE.md) がプロセスモジュールの標準。

### DriverInput

全ワークフローの第 1 引数:

```typescript
type DriverInput = AIDriver | DriverSet;

type DriverSet = { default: AIDriver } & {
  default?: AIDriver;
  thinking?: AIDriver;
  instruct?: AIDriver;
  chat?: AIDriver;
  plan?: AIDriver;
};
```

未指定 role は `default` にフォールバック。pi-provider の agentic は `buildDriverSetFromModelSet` で `DriverSet` を構築済み。

### 主要ワークフロー

| 関数 | 用途 | pi-provider |
|---|---|---|
| `defaultProcess` | compile + 1 回 query | 未使用（passthrough は driver 直） |
| **`streamProcess`** | チャンク逐次 + state 累積 | **compact (#58) の実行エンジン** |
| `concatProcess` | チャンク独立処理 + 結合 | 未使用 |
| `summarizeProcess` | 分析フェーズ + 要約フェーズ | compact の将来 strategy 候補 |
| `agenticProcess` | 計画 → タスク実行 | virtualModel agentic |
| `dialogueProcess` | 対話処理 | 未使用 |

### streamProcess の動き（compact 向け核心）

実装: `packages/process/src/workflows/stream-workflow.ts`

```
context.chunks[]  ──→  getNextRange() でバッチ化
        ↓ ループ
merge(streamProcessing, userModule) + context(state, range)
        ↓ compile()
driver.query(compiled)   ※非ストリーム（イテレーション単位）
        ↓
state.content を Next State として更新
        ↓ 全チャンク処理完了
WorkflowResult.output (= 最終 state.content)
```

**ポイント:**

- アプリ（strategy）は **ユーザ module** だけ定義すればよい。`streamProcessing` は process 側が自動 merge
- 各イテレーションは `driver.query`（ブロッキング）。チャットの `streamQuery` とは別経路
- `context.state` に前イテレーションまでの要約が蓄積される
- `options.tokenLimit` / `maxChunk` で 1 イテレーションあたりのチャンク量を制御
- `context.targetTokens` を指定すると、module 側でサイズ制御指示が付く

### StreamProcessingContext（process が期待する型）

```typescript
interface StreamProcessingContext {
  chunks?: Array<{
    content: string;
    partOf?: string;
    usage?: number;       // トークン見積もり（range 分割に使用）
  }>;
  state?: {
    content: string;      // Current State / 出力は Next State
    usage?: number;
  };
  range?: { start?: number; end?: number };
  targetTokens?: number;
}
```

compact strategy の責務の一つは、Pi `preparation.entriesToSummarize` からこの `chunks` を組み立てること。

### streamProcessing プロセスモジュール

`packages/process/src/modules/stream-processing.ts` が標準の **逐次処理の語彙**（Source Text, Chunk, Current State, Next State 等）を定義する。

ユーザ strategy の module は **圧縮手順（procedure）** を `methodology` / `instructions` / `guidelines` に書き、`streamProcessing` が提供する枠組みの上で動く。

## Driver 層

[skills/driver-usage/SKILL.md](https://github.com/otolab/modular-prompt/blob/main/skills/driver-usage/SKILL.md) 参照。

pi-provider 接続:

```
config.yaml models
    → AIService + model-registry（論理モデルごとシングルトン）
    → AIDriver.query / streamQuery
```

| 経路 | driver API |
|---|---|
| Pi chat（passthrough） | `streamQuery` |
| Pi agentic | `agenticProcess` 内部で複数 `query` |
| **Pi compact** | **`streamProcess` 内部で `query`（非ストリーム）** |

## Experiment パッケージ（`@modular-prompt/experiment`）

[skills/experiment/SKILL.md](https://github.com/otolab/modular-prompt/blob/main/skills/experiment/SKILL.md) 参照。

- YAML で modules / testCases / models を定義し、**同一条件下で PromptModule を比較**
- 現状 runner は **`defaultProcess` 固定**（`streamProcess` 差し替えは未対応）
- compact strategy の **procedure チューニング** には使えるが、stream ワークフロー検証は pi-provider 側テストか将来の experiment 拡張が必要

pi-provider での想定:

- `strategies/<id>/procedure.md` を module に読み込む方式は、experiment の module 定義パターンと親和性が高い
- `strategies/experimental-*/` は experiment 用 module を薄くラップして registry 登録

## pi-provider との対応表

| pi-provider | modular-prompt 層 |
|---|---|
| `src/adapter/context-to-prompt.ts` | core: Pi Context → `CompiledPrompt` |
| `src/workflow/passthrough.ts` | driver: `streamQuery` |
| `src/workflow/agentic.ts` | process: `agenticProcess` + ユーザ module |
| **`src/compact/strategies/*`**（#58） | process: **`streamProcess`** + 手順 module |
| `src/compact/types.ts` 等（root） | Application: インターフェイス・registry のみ |
| `src/driver/model-registry.ts` | driver: `AIDriver` 保持 |
| `processes.compaction`（config） | Application: compact 用 model 解決 |

## Compact (#58) への当てはめ

```
session_before_compact
    → adapters/pi-hook.ts          CompactInput
    → compact/index.ts             resolveStrategy(config.compact.strategy)
    → strategies/stream-summarize/
           procedure.md             圧縮手順（ドキュメント兼プロンプト素材）
           module.ts                PromptModule（procedure を instructions 等へ）
           run.ts                   chunks 生成 + streamProcess(driver, module, ctx)
    → summary を Pi に返却
```

**root（`src/compact/`）に置かないもの:**

- `streamProcess` 呼び出し
- procedure の具体的文言
- チャンク分割アルゴリズム

これらはすべて **strategy ディレクトリ** に閉じる。

## upstream 参照一覧

### docs/

| 文書 | 内容 |
|---|---|
| [CONCEPTS.md](https://github.com/otolab/modular-prompt/blob/main/docs/CONCEPTS.md) | 設計思想 |
| [ARCHITECTURE.md](https://github.com/otolab/modular-prompt/blob/main/docs/ARCHITECTURE.md) | 4 層アーキテクチャ |
| [PROMPT_MODULE_SPEC.md](https://github.com/otolab/modular-prompt/blob/main/docs/PROMPT_MODULE_SPEC.md) | PromptModule 完全仕様 |
| [PROCESS_MODULE_GUIDE.md](https://github.com/otolab/modular-prompt/blob/main/docs/PROCESS_MODULE_GUIDE.md) | プロセスモジュール・Context フィールド |
| [DRIVER_API.md](https://github.com/otolab/modular-prompt/blob/main/docs/DRIVER_API.md) | driver API |
| [packages/process/README.md](https://github.com/otolab/modular-prompt/blob/main/packages/process/README.md) | ワークフロー使用例 |

### skills/（エージェント向け要約）

| Skill | 内容 |
|---|---|
| [prompt-writing](https://github.com/otolab/modular-prompt/blob/main/skills/prompt-writing/SKILL.md) | PromptModule 記述 |
| [driver-usage](https://github.com/otolab/modular-prompt/blob/main/skills/driver-usage/SKILL.md) | AIDriver / AIService |
| [experiment](https://github.com/otolab/modular-prompt/blob/main/skills/experiment/SKILL.md) | 実験フレームワーク |

## 関連（pi-provider）

- [compaction.md](./compaction.md) — Pi `session_before_compact` 設計
- [workflow.md](./workflow.md) — `processes.compaction` 設定
- [modular-prompt-apis.md](./modular-prompt-apis.md) — driver 消費 API（旧来ドキュメント）
- Issue [#58](https://github.com/otolab/modular-prompt-pi-provider/issues/58)
