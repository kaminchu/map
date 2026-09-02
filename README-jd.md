# オフライン地図

[![CI](https://github.com/kaminchu/map/actions/workflows/ci.yml/badge.svg)](https://github.com/kaminchu/map/actions/workflows/ci.yml)

[English](README.md)

オフライン地図は、国土地理院の標準地図をオンラインでもオフラインでも閲覧できるProgressive Web Appです。表示した地図タイルをブラウザー内に保存するほか、現在の表示範囲を明示的にダウンロードし、ネットワークに接続できない状況でも地図を利用できます。

## 主な機能

- [MapLibre GL JS](https://maplibre.org/maplibre-gl-js/docs/)による国土地理院標準地図の表示
- 表示したタイルの自動キャッシュと、更新確認前のローカルタイル優先表示
- 現在の表示範囲と指定したズーム範囲のオフライン保存
- 保存範囲のダウンロードの一時停止、再開、更新、削除
- 権限が許可された場合の現在地、精度、端末方位の表示
- ストレージ使用量の確認、永続ストレージの要求、保存範囲を残したまま一時タイルを削除する機能
- PWAとしてのインストールと、オフライン時のアプリケーションシェル起動

## オフラインストレージの仕組み

地図タイルはブラウザーのOrigin Private File System（OPFS）に保存し、タイルのメタデータ、設定、保存範囲の情報はIndexedDBに保存します。Service Workerがキャッシュするのはアプリケーションシェルだけであり、地図タイルをCache Storageには保存しません。

タイルが要求されると、ローカルに保存済みのコピーがあれば即座に使用します。端末がオンラインで、そのコピーが24時間以上更新確認されていない場合は、バックグラウンドで再検証します。保存範囲に含まれるタイルは保護され、自動キャッシュされたタイルはストレージ上限を守るために削除される場合があります。

ダウンロードしたデータは、作成時に使用したブラウザープロファイルとオリジンに属します。サイトデータの消去やブラウザーのストレージ管理によって削除される場合があります。永続ストレージがブラウザーに許可されると削除のリスクは下がりますが、バックアップの代わりにはなりません。

## 必要環境

開発環境:

- [Node.js](https://nodejs.org/) 22
- npm
- [Zstandard](https://facebook.github.io/zstd/)（`zstd`コマンド）

すべての機能を利用するには、WebGL、Service Worker、IndexedDB、OPFSに対応するモダンブラウザーが必要です。現在地、端末方位、永続ストレージ、PWAのインストールは、ブラウザーと端末の対応状況によって利用できない場合があります。これらの機能は通常、本番環境ではHTTPSが必要です。ローカル開発時の`localhost`はセキュアコンテキストとして扱われます。

OPFSに対応していないブラウザーでもオンライン地図は表示できますが、オフライン範囲のダウンロードと地図タイルの永続キャッシュは利用できません。

## セットアップ

```sh
git clone https://github.com/kaminchu/map.git
cd map
npm ci
npm run dev
```

Viteが表示するローカルURLを開いてください。本番ビルドとService Workerをローカルで確認する場合は、次を実行します。

```sh
npm run build
npm run preview
```

## 使い方

1. オンラインの状態で**地図**を開き、必要な範囲へ移動してズームします。
2. **範囲を保存**を選択し、名前とズーム範囲を確認してダウンロードを開始します。
3. **保存地図**を開き、ダウンロードの進捗確認、一時停止、再開、更新、削除を行います。
4. ダウンロードが完了すると、保存済みのタイルをネットワーク接続なしで表示できます。

現在地と方角の各機能は、その操作を行ったときに対応するブラウザー権限を要求します。現在、アプリケーションの画面表示は日本語です。

## 開発

| コマンド               | 用途                                       |
| ---------------------- | ------------------------------------------ |
| `npm run dev`          | Vite開発サーバーを起動する                 |
| `npm run test`         | Vitestをwatchモードで実行する              |
| `npm run test:run`     | テストスイートを1回実行する                |
| `npm run lint`         | oxlintでコードを検査する                   |
| `npm run format`       | oxfmtでコードを整形する                    |
| `npm run format:check` | ファイルを変更せずにフォーマットを検査する |
| `npm run build`        | 型チェックを行い、本番ビルドを作成する     |
| `npm run preview`      | 本番ビルドをローカルでプレビューする       |

変更を提出する前に、次を実行してください。

```sh
npm run test:run
npm run lint
npm run format:check
npm run build
```

GitHub Actionsはpushとpull requestでテストを実行します。`main`へのpushでは、サイトのビルドとGitHub Pagesへのデプロイも行います。ドメインのサブパス以下でホストする場合は、ビルド時に`BASE_PATH`環境変数を設定できます。

## 技術スタック

- React、TypeScript
- Vite、`vite-plugin-pwa`
- MapLibre GL JS
- Zustand、SWR、wouter、Zod
- OPFS、IndexedDB
- Vitest、Testing Library、oxlint、oxfmt

## 地図データと出典

このプロジェクトは、国土地理院が提供する標準地図タイルを使用しており、地図上に必要な出典を表示します。公開環境を運用する場合や、ダウンロードしたデータを再配布する場合は、最新の[地理院タイル一覧と利用規約](https://maps.gsi.go.jp/development/ichiran.html)を確認してください。

## ライセンス

現在、このリポジトリにはライセンスファイルが含まれていません。
