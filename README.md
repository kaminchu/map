# オフライン地図

国土地理院の標準地図を、OPFSへ保存してオフラインでも表示するPWAです。

## 開発

```sh
npm install
npm run dev
```

品質確認:

```sh
npm run test:run
npm run lint
npm run format:check
npm run build
```

## リリース前チェック

- 国土地理院の[地理院タイル利用規約・提供条件](https://maps.gsi.go.jp/development/ichiran.html)を実装時点の内容で確認する。
- attributionが地図上に表示され、公開先の利用条件に合っていることを確認する。
- HTTPS相当の環境でPWAをインストールし、App Shellのオフライン起動を確認する。
- 保存地図がOPFS、メタデータとエリア情報がIndexedDBに保存され、Service WorkerのCache Storageへ地図タイルが保存されていないことを確認する。
- Android Chrome／PWA、iOS Safari／Home Screen PWA、Desktop ChromeまたはEdge、Desktop Safariで手動確認マトリクスを実施する。
