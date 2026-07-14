# extract-log

[sprite-claude `packages/anthropic-server/src/analysis`](https://github.com/otolab/sprite-claude) から移植。

## 差分（pi-provider 側）

- `log-reader.ts`: デフォルト dir は `resolveConfiguredRequestLogDir()`（`config.yaml` の `logging.dir`）
- `session-summary.ts` / `message-detail.ts`: pi-provider の `in`/`out`（phase `stream`）を summary / show で読めるよう最小パッチ
- `extract-log.ts`: ヘルプ文言・`--dir` オプション

upstream と揃える場合は sprite-claude 側をマージし、上記差分だけ再適用する。
