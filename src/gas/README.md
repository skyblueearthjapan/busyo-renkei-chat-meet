# 部署クイック連絡ポータル - GAS Webアプリ

Google Apps Script (GAS) で構築した社内部署間連絡ポータルです。
Google Chat と Google Meet を統合し、通話後のメモ機能を提供します。

## 機能概要

- **部署一覧表示**: スプレッドシートのDept_Masterから部署を一覧表示
- **Chatボタン**: 対象部署のGoogle Chatスペースを開く
- **Meetボタン**: Google Meet会議を作成し、対象部署に通知
- **メモ機能**: 通話中/通話後に要点を記録
- **履歴機能**: 過去のメモを一覧・詳細表示

## ファイル構成

```
src/gas/
├── Code.gs                          # メインエントリポイント
├── appsscript.json                  # マニフェストファイル
├── services/
│   ├── SheetService.gs              # スプレッドシート操作
│   ├── AuthService.gs               # 認証関連
│   ├── GoogleChatService.gs         # Chat API連携
│   └── GoogleMeetService.gs         # Meet API連携
└── ui/
    ├── index.html                   # メインHTMLテンプレート
    ├── styles.css                   # スタイルシート
    └── app.js                       # フロントエンドJS
```

## セットアップ手順

### 1. スプレッドシートの準備

1. Google スプレッドシートを作成
2. 以下のシートを用意（docs/spreadsheet-schema.md 参照）:
   - README
   - Lookup
   - Dept_Master
   - Connection_Rules
   - Interaction_Log
   - Session_Memos
   - History_View

### 2. GASプロジェクトの作成

1. スプレッドシートを開く
2. 「拡張機能」→「Apps Script」を選択
3. 新規プロジェクトが作成される

### 3. ファイルのコピー

以下の順序でファイルを作成:

1. `Code.gs` - プロジェクト作成時にデフォルトで存在するファイルを上書き
2. `services/SheetService.gs` - 新規ファイル作成
3. `services/AuthService.gs` - 新規ファイル作成
4. `services/GoogleChatService.gs` - 新規ファイル作成
5. `services/GoogleMeetService.gs` - 新規ファイル作成
6. `ui/index.html` - HTMLファイルとして作成
7. `ui/styles.css` - HTMLファイルとして作成（`<style>`タグ含む）
8. `ui/app.js` - HTMLファイルとして作成（`<script>`タグ含む）

### 4. マニフェストの設定

1. 「プロジェクトの設定」を開く
2. 「「appsscript.json」マニフェストファイルをエディタで表示する」にチェック
3. `appsscript.json` を編集

### 5. デプロイ

1. 「デプロイ」→「新しいデプロイ」を選択
2. 種類: ウェブアプリ
3. 説明: 任意
4. 次のユーザーとして実行: 「ウェブアプリケーションにアクセスしているユーザー」
5. アクセスできるユーザー: 「組織内の全員」または適切な範囲
6. 「デプロイ」をクリック
7. URLをコピーして共有

## 必要なAPI/権限

- Google Sheets API（自動）
- Google Chat API（Admin Console で有効化が必要な場合あり）
- Google Meet REST API（Workspace アカウントで利用可能）
- Google Calendar API（Meet APIのフォールバック用）

## スクリプトプロパティ

以下のスクリプトプロパティを必要に応じて設定:

| プロパティ名 | 説明 | 例 |
|-------------|------|-----|
| nextEventId | イベントID連番 | 1 |
| nextMemoId | メモID連番 | 1 |
| adminEmails | 管理者メール（カンマ区切り） | admin@example.com |

## トラブルシューティング

### Chat通知が送信されない

- Google Chat API が有効になっているか確認
- スペースIDが正しい形式（spaces/XXX）か確認
- Botがスペースに追加されているか確認

### Meet作成に失敗する

- Meet REST API が利用可能なアカウントか確認
- Calendar API経由のフォールバックが動作しているか確認

### 権限エラーが発生する

- OAuthスコープが正しく設定されているか確認
- 再デプロイ（新しいバージョン）を試す

## 開発時の注意

- GASはファイル名でソートされた順に読み込まれる
- サービス系ファイルは `services/` プレフィックスで先に読み込まれるように配置
- HTMLファイルは `HtmlService.createTemplateFromFile()` で読み込み
