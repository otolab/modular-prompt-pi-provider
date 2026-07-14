# ログ（JSONL）

Pi プラグインの LLM 呼び出しデバッグログ。sprite-claude のリクエスト JSONL を Pi 向けに縮小したもの。

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

**JSONL 形式**は sprite-claude のリクエストログと互換（`LogEntry`・ファイル名 `{ts}-{pid}-{seqId}.jsonl`）。ただし sprite-claude 本体の `extract-log` はログ dir が `~/.sprite-claude/logs/requests` 固定のため、そのままでは pi-provider のログを読めない。

本リポジトリの `npm run extract-log` は sprite-claude の **`summary` / `show` 相当を移植した縮小版**。`--messages` / `--raw` / `tasks` / `server` 等は含まない。フル機能が必要なら sprite-claude 側に dir 指定を足すか、Phase 2 で拡張する。

```bash
npm run extract-log -- summary
npm run extract-log -- show --seq 0001
npm run extract-log -- show --seq 1 --dir ~/.pi/agent/modular-prompt-provider/logs/requests
```

`--dir` 省略時のデフォルトは `~/.pi/agent/modular-prompt-provider/logs/requests`。

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
