# テスト戦略

本リポジトリのテストは **Unit / Integration / Experiment** の 3 層に分ける。
目的と実行タイミングが異なるため、同じ vitest プロジェクトに混在させない。

## 3 層の責務

```
┌─────────────────────────────────────────────────────────┐
│  Unit          決定的・高速・CI 必須                      │
│  「配線と変換が正しいか」                                  │
├─────────────────────────────────────────────────────────┤
│  Integration   MLX 実機・逐次・CI は任意                    │
│  「本番経路が一度は動くか」（pass/fail のみ）               │
├─────────────────────────────────────────────────────────┤
│  Experiment    手動 or 明示 opt-in・品質・性能・比較        │
│  「良いか・速いか・どの strategy が良いか」                 │
└─────────────────────────────────────────────────────────┘
```

| 層 | ディレクトリ | コマンド | CI | 典型アサーション |
|---|---|---|---|---|
| Unit | `test/` | `npm run test:run` | ✅ | 厳密な等価・モック呼び出し |
| Integration | `tests/integration/` | `npm run test:integration` | 任意 | `stopReason !== error`、非空応答 |
| Experiment | `tests/experiment/`（予定）+ CLI | `npm run compact:experimental` 等 | ❌ | 人手レビュー・ベンチマーク |

## Unit

**書くもの**

- アダプタ変換（`usage`, `options`, `message-mapper`, `context-to-prompt`）
- config 解決・バリデーション（`validate-config`, `normalize-config`）
- workflow ロジック（`TestDriver` + mock `getDriverForLogicalModel`）
- Pi ストリーム契約（`test/stream-events.test.ts`）
- フック登録（`compaction-hooks`, `session-hooks`）

**書かないもの**

- MLX 推論結果の文言・要約品質
- TTFT / tok/s
- モデル固有の tool call 成功率

設定: `vitest.config.ts`（`testTimeout: 10s`、逐次実行）

## Integration

**書くもの**

- MLX 実機でのエンドツーエンド smoke
- `streamModularPrompt` 経由の Pi stream 完走
- workflow（passthrough / virtualModel / agentic）の配線確認
- KV キャッシュの有効化確認（構造のみ、性能は experiment）

**書かないもの**

- 応答テキストの品質評価
- compact 要約の妥当性（experiment へ）
- Pi 公式 `stream.test.ts` 等の完全互換（#35 で別管理）

設定: `vitest.integration.config.ts`（`testTimeout: 600s`、逐次実行）

### プローブとスキップ

起動時に `tests/integration/support/mlx-probe.ts` が 1 回だけ MLX をプローブする。

| 条件 | 動作 |
|---|---|
| MLX 未導入・推論失敗 | `describe.skipIf(!probe.runtimeAvailable)` で skip |
| VLM 等 KV 非対応 | `cache-hit` のみ `probe.cacheSupported` で skip |
| `SKIP_INTEGRATION=1` | プローブ段階で skip |

モデルは `INTEGRATION_MLX_MODEL` で上書き。デフォルトは [`prism-ml/Ternary-Bonsai-1.7B-mlx-2bit`](https://huggingface.co/prism-ml/Ternary-Bonsai-1.7B-mlx-2bit)（`INTEGRATION_MLX_MODEL_DEFAULT`）。アプリの `MODULAR_PROMPT_PI_MODEL` にはフォールバックしない。

### ファイル一覧

| ファイル | 経路 | 内容 |
|---|---|---|
| `workflow-stream.test.ts` | `streamModularPrompt` | 論理モデル / virtual passthrough / agentic smoke（#56） |
| `cache-hit.test.ts` | driver 直叩き + Pi stream | KV キャッシュ |
| `compact-engine.test.ts` | `runCompact()` 直叩き | compact strategy smoke（Pi フック外） |
| `support/build-integration-config.ts` | — | integration 用 config ビルダー |
| `support/collect-stream.ts` | — | Pi ストリーム消費ヘルパー |
| `support/mlx-probe.ts` | — | 実機プローブ |

### Issue #56 との対応

| #56 項目 | 層 | テスト |
|---|---|---|
| 論理モデル + passthrough（Pi 経由） | integration | `workflow-stream.test.ts` |
| virtualModel passthrough | integration | 同上 |
| virtualModel agentic | integration | 同上 |
| 不正 config 起動時エラー | unit | `test/validate-config.test.ts`（既存） |

## Experiment

**書くもの**

- compact 要約の品質比較（fixture + 人手 or ルーブリック）
- strategy 間の比較（`stream-summarize` vs `summarize-process`）
- TTFT / tok/s / cache ヒット率のベンチマーク
- procedure / prompt チューニング

**エントリポイント**

- `npm run compact:experimental` — `src/compact/experimental/cli.ts`
- `fixtures/compact/` — セッション fixture

将来 `tests/experiment/` + `vitest.experiment.config.ts` を追加し、`EXPERIMENT=1` 時のみ実行する想定。CI には載せない。

## npm scripts

```bash
npm run test:run           # unit のみ（CI と同じ）
npm run test:integration   # MLX 実機 integration
npm run test:all           # unit + integration
npm run compact:experimental -- --strategy stream-summarize --driver mlx
```

| 環境変数 | 用途 |
|---|---|
| `SKIP_INTEGRATION=1` | integration 全体をスキップ |
| `INTEGRATION_MLX_MODEL` | 実機モデル上書き |
| `EXPERIMENT=1` | experiment テスト有効化（将来） |

## CI

`.github/workflows/ci.yml` は **unit のみ** 実行。integration はローカルまたは別 workflow（nightly / manual）を想定。

MLX モデルはメモリ制約のため **逐次実行**（`fileParallelism: false`, `maxWorkers: 1`）を unit / integration 共通で維持する。

## 関連

- [implementation-plan.md](./implementation-plan.md) — ファイル構成・テスト一覧
- [compaction.md](./compaction.md) — compact integration / experimental の使い方
- Issue [#56](https://github.com/otolab/modular-prompt-pi-provider/issues/56) — MLX 実機確認
- Issue [#35](https://github.com/otolab/modular-prompt-pi-provider/issues/35) — Pi 公式 provider テスト統合
