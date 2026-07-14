# ログ（JSONL）

Pi プラグインの LLM 呼び出しデバッグログ。sprite-claude のリクエスト JSONL と同形式。

設定の置き場所は [configuration.md](./configuration.md) を参照。

## 有効化

`modular-prompt-provider/config.yaml` の `logging` セクションのみ。環境変数での有効化はしない。

| `requestResponseLevel` | 結果 |
|---|---|
| 未指定（`logging:` あり） | `minimal` |
| `none` | 無効 |
| `minimal` | メタデータ中心 |
| `full` | prompt 全文を含む |

```yaml
logging:
  level: info
  requestResponseLevel: full   # none | minimal | full
  dir: ~/.pi/agent/modular-prompt-provider/logs/requests
```

`logging` セクション自体が無い場合は記録しない。`dir` 未指定時はプラグインデータ dir 配下の `logs/requests/` を使う。

## 保存先

| 種類 | パス | 単位 |
|---|---|---|
| リクエストログ | `{logging.dir}/{timestamp}-{pid}-{seqId}.jsonl` | 1 LLM 呼び出し |
| サーバーログ | `{logging.dir}/../server-{pid}.jsonl` | cache eviction 等 |

Pi セッション JSONL（`~/.pi/agent/sessions/`）とは別。

## LogEntry 形式

sprite-claude と同じ `LogEntry`（`src/extract-log/types.ts` 参照）。

```typescript
interface LogEntry {
  timestamp: string;
  pid: number;
  seqId: string;
  phase: string;       // in/out は request / response、その他は stream 等
  type: "in" | "out" | "prompt" | "llm_response" | "error" |
        "driver_info" | "cache_stats" | "eviction";
  data: unknown;
}
```

典型的な 1 リクエスト: `in` → `driver_info` → `prompt` → `llm_response` → (`cache_stats`) → `out`

| type | 内容 |
|---|---|
| `in` | モデル ID、sessionId、メッセージ数、cache オプション |
| `driver_info` | provider、capabilities、cacheDir |
| `prompt` | `formatCompletionPrompt` 結果 |
| `llm_response` | content / usage / finishReason |
| `cache_stats` | `cacheReadTokens` / `cacheWriteTokens` |
| `error` | 例外・abort |
| `eviction` | CacheManager sweep（サーバーログ） |

## extract-log（調査 CLI）

[sprite-claude `extract-log`](https://github.com/otolab/sprite-claude/tree/main/packages/anthropic-server/src/analysis) を **`src/extract-log/` にコピー**し、`--dir` を追加したもの。別実装ではない。

```bash
npm run extract-log -- summary
npm run extract-log -- show --seq 0001
npm run extract-log -- --dir ~/.pi/agent/modular-prompt-provider/logs/requests summary
```

デフォルト dir: `~/.pi/agent/modular-prompt-provider/logs/requests`（`logging.dir` と同じ）。

sprite-claude と同様に `summary` / `show`（`--messages` / `--raw` / `--phase`）/ `tasks` / `phases` / `server` が使える。pi-provider のログは HTTP API 形式ではないため `--messages` の一部は空になる。

## Phase 分割（Issue #42）

| Phase | 内容 | 状態 |
|---|---|---|
| Phase 1 | JSONL 記録 + extract-log 移植 | 本 PR |
| Phase 2 | driver `logEntries` 転記、`inspect` 拡充 | 将来 |

## 関連 Issue

- [#42](https://github.com/otolab/modular-prompt-pi-provider/issues/42) — 本 Issue
- [#30](https://github.com/otolab/modular-prompt-pi-provider/issues/30) — KV キャッシュ（`cache_stats`）
- [#25](https://github.com/otolab/modular-prompt-pi-provider/issues/25) — discovery 時の `driver_info` 拡張
