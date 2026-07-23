# エージェント向けガイド

本リポジトリ（`modular-prompt-pi-provider`）で作業する際の前提。

## MLX に限定しない

本プラグインは **Pi の `streamSimple` と `@modular-prompt/driver` の `AIDriver` を橋渡しする** のが責務である。実装の中心は MLX 子プロセス固有のロジックではなく、**プロバイダ非依存のアダプタ層**にある。

- **Pi から見える API**: `registerProvider` の `streamSimple`（実装: `streamModularPrompt` in `src/stream-simple.ts`）
- **バックエンド**: 現状の主戦場は MLX（`provider: mlx`）だが、`AIDriver` 実装が増えても同じ経路で扱う
- **命名**: 公開関数・型に `Mlx` を付けない（例: ~~`streamModularPromptMlx`~~ → `streamModularPrompt`）。MLX 専用の処理だけ `mlx-*` や `MlxCacheController` 等の既存 driver 用語を使う
- **テスト**: ユニットテストは `TestDriver` でプロバイダ非依存に書ける。MLX 実機は `tests/integration/` のみ

新規コードでは「MLX 直結」と読める名前を避け、論理モデル・workflow・driver 抽象に沿って命名する。
