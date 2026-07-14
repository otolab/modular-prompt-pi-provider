# 配布とパッケージ名

## 配布形態

本プロジェクトは **Pi パッケージ** として配布する。

参照: [Pi packages.md](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/packages.md)

```json
{
  "name": "@modular-prompt/pi-provider-ext",
  "keywords": ["pi-package"],
  "pi": {
    "extensions": ["./src/index.ts"]
  }
}
```

Pi は jiti で TS を直接ロードするため、**ビルドは publish 時も必須ではない**（型チェック用に `tsc --noEmit` は維持）。

## インストール方法

### 開発中

```bash
# ローカルパス
pi install /Users/you/Develop/otolab/modular-prompt-pi-provider

# git
pi install git:github.com/otolab/modular-prompt-pi-provider@main
```

### プロジェクト共有

```bash
pi install -l git:github.com/otolab/modular-prompt-pi-provider@main
```

`.pi/settings.json` に記録され、プロジェクト trust 後に自動ロード。

### npm（publish 後）

```bash
pi install npm:@modular-prompt/pi-provider-ext
```

## リポジトリと npm の関係

| 項目 | 値 |
|---|---|
| GitHub | `otolab/modular-prompt-pi-provider` |
| npm | `@modular-prompt/pi-provider-ext` |
| スコープ | `@modular-prompt`（driver / core と同じ） |

**別リポジトリから同じ npm org スコープへ publish 可能**。npm org のメンバー権限があれば、monorepo でなくても `@modular-prompt/*` を追加できる。

```json
"publishConfig": {
  "access": "public",
  "registry": "https://registry.npmjs.org/"
}
```

publish 時は `package.json` の `"private": true` を外す。

## パッケージ名の候補

| 名前 | 長所 | 短所 |
|---|---|---|
| **`@modular-prompt/pi-provider-ext`**（現行） | driver 系列と一貫、`provider` + `ext` が明確 | やや長い |
| `@modular-prompt/pi-mlx-provider` | MLX 専用と明示 | 将来 HTTP 橋を足すと名前が狭い |
| `@modular-prompt/pi-driver` | 短い | `@modular-prompt/driver` と紛らわしい |
| `pi-modular-prompt`（無スコープ） | ギャラリー検索向き | org 系列から外れる |

コミュニティで多いのは **`pi-<機能>`**（無スコープ）と **`@org/pi-<機能>`**。`@modular-prompt` スコープを維持するなら現行名で問題ない。

## 依存関係

```json
{
  "dependencies": {
    "@modular-prompt/driver": "^0.13.4"
  },
  "peerDependencies": {
    "@earendil-works/pi-ai": "*",
    "@earendil-works/pi-coding-agent": "*"
  }
}
```

- `dependencies`: `pi install` 時に `npm install` され、**MLX Python セットアップ（postinstall）も走る**
- `peerDependencies`: Pi がバンドル。重複インストールしない

## 別レジストリについて

技術的には GitHub Packages 等も可能だが、利用者の `.npmrc` 設定が増える。**driver と同じ npmjs.org を推奨**。

## セキュリティ

Pi パッケージは **フルシステム権限** で実行される。第三者配布時はソースレビュー前提を README に明記する（[packages.md の警告](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/packages.md) と同趣旨）。
