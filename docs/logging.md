# ログ（JSONL）

Pi プラグインの LLM 呼び出しデバッグログ。sprite-claude のリクエスト JSONL を Pi 向けに縮小したもの。

設定の置き場所は [configuration.md](./configuration.md) を参照。

## 有効化

| 方法 | 結果 |
|---|---|
| `config.yaml` の `logging.requestResponseLevel` | `none`（無効）/ `minimal` / `full` |
| 環境変数 `MODULAR_PROMPT_PI_DEBUG=1` | `logging` 未指定時は `full`。指定済みなら YAML を優先 |

```yaml
logging:
  level: info
  requestResponseLevel: full   # none | minimal | full
  dir: ~/.pi/agent/modular-prompt-provider/logs/requests
```

`dir` 未指定時はプラグインデータ dir 配下の `logs/requests/` を使う。

## 保存先

| 種類 | パス | 単位 |
|---|---|---|
| リクエストログ | `{logging.dir}/{timestamp}-{pid}-{seqId}.jsonl` | 1 LLM 呼び出し |
| プロセスログ | `{logging.dir}/../process-{pid}.jsonl` | cache eviction 等 |

Pi セッション JSONL（`~/.pi/agent/sessions/`）とは別。

## LogEntry 形式

```typescript
interface LogEntry {
  timestamp: string;   // ISO 8601
  pid: number;
  seqId: string;       // 0001, 0002, ...
  phase: string;       // 通常 "stream"
  type: "in" | "out" | "prompt" | "llm_response" | "error" |
        "driver_info" | "cache_stats" | "eviction";
  data: unknown;
}
```

典型的な 1 リクエスト: `in` → `driver_info` → `prompt` → `llm_response` → (`cache_stats`) → `out`

| type | 内容 |
|---|---|
| `in` | モデル ID、sessionId、メッセージ数、cache オプション |
| `driver_info` | provider、capabilities、cacheDir（#25 discovery 前の暫定） |
| `prompt` | `formatCompletionPrompt` 結果（`minimal` では省略なし、`none` では記録しない） |
| `llm_response` | content / usage / finishReason（`minimal` は長さのみ） |
| `cache_stats` | `cacheReadTokens` / `cacheWriteTokens`（KV 利用時） |
| `error` | 例外・abort |
| `eviction` | CacheManager sweep 結果（プロセスログ） |

## extract-log（調査 CLI）

```bash
npm run extract-log -- summary
npm run extract-log -- show --seq 0001
npm run extract-log -- show --seq 1 --dir /path/to/logs/requests
```

環境変数 `MODULAR_PROMPT_PI_LOG_DIR` でディレクトリを上書きできる。

## Phase 分割（Issue #42）

| Phase | 内容 | 状態 |
|---|---|---|
| Phase 1 | JSONL 記録（本ドキュメント） | 本 PR |
| Phase 2 | `inspect`、driver `logEntries` 転記、ガイド拡充 | 将来 |
| — | `ServerLogger`（HTTP サーバーなし） | 不要 |
| — | `task_registration` / routing | 不要 |

## 関連 Issue

- [#42](https://github.com/otolab/modular-prompt-pi-provider/issues/42) — 本 Issue
- [#30](https://github.com/otolab/modular-prompt-pi-provider/issues/30) — KV キャッシュ（`cache_stats`）
- [#25](https://github.com/otolab/modular-prompt-pi-provider/issues/25) — discovery 時の `driver_info` 拡張
