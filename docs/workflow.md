# Workflow 設計（Issue #40）

Pi プラグインにおけるモデル選択・workflow 実行の設計。Phase 1 は設定スキーマと名前解決、Phase 2 以降で workflow 実行を実装する。

## 背景

従来は YAML `models[]` に物理モデルパスを直接列挙し、Pi `model.id` も物理パスと一致させていた。Issue #40 では sprite-claude の workflow 概念を参考に、**論理名 → 物理モデル → プロバイダ** の解決層を新設する。

## 設定レイヤ

```
providers          … 接続設定（mlx / mlx_lm 等）
    ↓
models             … 論理名 → { provider, model, defaultQueryOptions, ... }
    ↓
modelSets          … 役割名 → models 論理名（virtualModel 参照不可）
    ↓
workflow           … type + modelSet + virtualModel（Pi 一覧への export）
    ↓
processes          … LLM を呼ぶ処理名 → model（論理名 or virtualModel）
```

### providers

- 旧 `drivers.mlx` は `providers.mlx` にマージされる（後方互換）
- `providers.mlx_lm` は driver の `mlx` プロバイダに正規化

### models

| 項目 | 説明 |
|---|---|
| 論理名 | YAML マップのキー。Pi `model.id` として公開 |
| `model` | 物理モデルパス（HuggingFace ID 等） |
| `defaultQueryOptions` | **必須**。stream 時のデフォルト QueryOptions |
| `disabled` | `true` なら Pi 一覧・modelSet 解決から除外 |

レガシー `models[]` 配列も引き続きサポート:

- 論理名 = `entry.id ?? entry.model`
- `defaultOptions` は `defaultQueryOptions` のエイリアス

### modelSets

役割（`chat`, `default`, `plan` 等）から models 論理名への束。modelSet 自体は実行しない。

- 参照できるのは `models` 論理名のみ（**virtualModel 不可**）

### workflow

```yaml
workflow:
  agentic:
    type: agentic          # passthrough | agentic
    modelSet: default
    virtualModel: agentic-chat   # 任意。設定時のみ Pi 一覧に表示
```

- `virtualModel` は models とは別名前空間
- Phase 1: Pi 一覧に載せるのみ。agentic 選択時は Phase 3 エラー
- Phase 2: 論理モデルは暗黙 passthrough workflow 経由で実行
- Phase 3: virtualModel + agentic workflow 実行（agentic は非ストリーム）

### processes

LLM を呼ぶ処理ごとのモデル割当。Pi には非表示。

- `processes.default` は **Pi が渡す `model.id` が未登録のとき**にフォールバック（登録済み id はそのまま使用）
- `processes.default.model` は論理名のみ（virtualModel 不可）

### workflow 実行（Phase 3）

| workflow.type | 挙動 |
|---|---|
| `passthrough` | modelSet の `chat`（なければ `default`）論理モデルで passthrough ストリーム |
| `agentic` | modelSet から DriverSet を構築し `agenticProcess` 実行（非ストリーム） |

`virtualModel` には `modelSet` が必須。

## ランタイム解決

### Pi model.id

| 値 | 解決 |
|---|---|
| models 論理名 | `resolveStreamSelection` → passthrough workflow → driver |
| 未登録 id | `processes.default` にフォールバック（設定時） |
| virtualModel 名 | `resolveSelection` → workflow 実行（passthrough / agentic） |

### Driver 保持

- **論理モデルごとに driver シングルトン**（`model-registry.ts`）
- 旧 `pool.ts` の「プロセス全体で MLX 1 つ」制約は撤廃
- 同時作成は inflight dedup

### stream 時の QueryOptions

```
mergeQueryOptions(
  defaultQueryOptions,   # models 定義
  piOptionsToQueryOptions(...)  # Pi 側（override 優先）
)
```

## フェーズ

| Phase | 内容 | 状態 |
|---|---|---|
| 1 | 型・正規化・名前解決・driver レジストリ・ドキュメント | 完了 |
| 2 | passthrough workflow + stream 配線 | 完了 |
| 3 | virtualModel + agentic workflow | 完了 |

## 関連ファイル

| ファイル | 責務 |
|---|---|
| `src/config/types.ts` | 型定義 |
| `src/config/normalize-config.ts` | YAML → ResolvedProviderConfig |
| `src/config/resolve-selection.ts` | model.id 解決・フォールバック |
| `src/workflow/passthrough.ts` | passthrough workflow 実行 |
| `src/workflow/run-virtual.ts` | virtualModel workflow ディスパッチ |
| `src/workflow/agentic.ts` | agentic workflow |
| `src/workflow/driver-set.ts` | modelSet → DriverSet |
| `src/config/resolve-model-set.ts` | modelSet 役割解決 |
| `src/driver/model-registry.ts` | 論理モデルごと driver |
| `src/driver/model-catalog.ts` | Pi モデル一覧生成 |
| `src/adapter/stream-bridge.ts` | 解決 + workflow + stream 橋渡し |

## 参照

- Issue [#40](https://github.com/otolab/modular-prompt-pi-provider/issues/40)
- [configuration.md](./configuration.md)
- [architecture.md](./architecture.md)
