# 部署クイック連絡ポータル（GAS Webアプリ）設計仕様 v0.1

作成日: 2026-01-08
対象: コーディングエージェント（Google Apps Script + Spreadsheet + Chat/Meet連携）
目的: 工場/事務所の誰でも"迷わず"部署へ **Chat** / **Meet** で即連絡でき、通話中/通話後に **メモ（1分メモ）** を残し、履歴として見返せる仕組みを作る。

---

## 0. ゴール（体験）

### 0-1. ユーザー体験（最重要）

- Googleアカウントでログイン済みのユーザーが、ポータルを開く
- 縦長に並んだ部署カードから、対象部署を選び **[Chat]** / **[Meet]** を1タップ
- Meetの場合:
  - すぐにMeetリンクを生成して自分は参加
  - 宛先部署のChatスペースにも「参加」ボタン付き通知が飛ぶ（電話の呼び出し感）
- "会話の全文"は記録しない（リスク/運用負荷）
  代わりに、**通話中/通話後に要点を残せるメモUI**を用意し、スプレッドシートに保存
- 後で履歴として、問い合わせ種別・要点・担当・期限・結果が閲覧できる

### 0-2. UIトーン

- かわいい・丸み・親しみやすい
- 白ベース + 淡い水色/淡い黄緑（アクセント）
- 工場の方・事務所の方・女性スタッフにも「使う気になる」雰囲気
- 尖った/硬いUIは避ける（角丸、余白、柔らかい配色、アイコン）

---

## 1. スコープ

### 1-1. 今回（MVP）

- GAS Webアプリ（HTML/JS/CSS）でポータルUI
- 部署マスタ（Spreadsheet）から部署一覧表示
- Chatボタン:
  - 対象部署のChatスペースURLを開く（またはGAS経由でスペースに通知投稿）
- Meetボタン:
  - Meet会議スペースを作成 → meetingUri取得
  - 宛先部署Chatスペースへ「参加」通知投稿
  - 自分用に meetingUri へ遷移（新規タブ推奨）
- ログ:
  - Interaction_Logへイベント記録
- メモ:
  - Session_Memosへ要点記録（テンプレ＋短文）
- 履歴:
  - "最近のメモ"一覧＋詳細表示（アプリ内で見返せる）

### 1-2. 将来（拡張）

- 拠点フィルタ/お気に入り/履歴検索の強化
- 部署間ルール（Connection_Rules）をUIで活用（推奨連絡先の上位固定など）
- ダッシュボード（問い合わせ種別・部署別件数・未完の可視化）
- 添付（写真/図面）のリンク管理を強化（Drive連携）
- 通話中メモのリアルタイム共同編集（将来案。まずは簡易で）

---

## 2. 画面設計

### 2-1. 画面一覧

| 画面 | 名称 | 説明 |
|------|------|------|
| A | 部署一覧（Home） | メイン画面。部署カード一覧とChat/Meetボタン |
| B | メモ入力（Quick Memo） | 通話中/通話後の要点記録 |
| C | 履歴一覧（History） | Session_Memosの一覧表示 |
| D | 履歴詳細（History Detail） | メモの詳細表示・編集 |
| E | 設定/ヘルプ（Settings/Help） | 簡易設定画面 |

---

### 2-2. 画面A: 部署一覧（Home）

#### レイアウト（スマホ優先、PC横長も対応）

- **上部:**
  - タイトル「部署クイック連絡」
  - 検索バー（部署名フィルタ）
  - 拠点フィルタ（任意：All/本社/工場/事務所）
- **本体:**
  - 部署カード（縦長リスト）
    - 左: 部署名 + サブ説明（任意）
    - 右: 角丸ボタン2つ [Chat] [Meet]
- **下部（固定タブ、任意）:**
  - [履歴] [メモ] [設定]

#### 部署カードUI要件

- 角丸（border-radius: 16〜20px）
- 背景: 白
- 影: 軽い（soft shadow）
- アクセント: 上部に細い帯 or 左側にカラーライン（水色/黄緑）
- ボタン:
  - Chat: 淡い水色系
  - Meet: 淡い黄緑系
  - 両方とも角丸（radius 999px 推奨）で"ぷにっ"とした見た目

#### ボタン動作

**Chat:**
- dept設定があれば `chat_url` を新規タブで開く
- 併せて Interaction_Log に「OpenChat」記録
- （推奨）GAS経由で対象スペースに「◯◯さんが連絡開始」通知も送れるようにする（ON/OFF可）

**Meet:**
- APIで会議スペース作成 → meetingUri取得
- 宛先スペースへ「参加」カード送信
- Interaction_Logに「CreateMeet」「NotifyChat」記録
- meetingUriへ遷移（新規タブ）
- 遷移後、メモ入力画面Bへ誘導できる導線（同一タブに残す）

#### 未設定部署の扱い

- Chat/Meetリンク未設定の場合:
  - ボタンをdisabled +「準備中」
  - 押下時はトーストで「この部署は未設定です（管理者へ）」を表示

---

### 2-3. 画面B: メモ入力（Quick Memo）

#### 目的

通話中/通話後に"1分"で残せる、業務に役立つ要点記録

#### 入力項目（MVP）

| 項目 | 説明 | 必須 |
|------|------|------|
| 関連event_id | 自動で紐付け | - |
| 発信部署 | 自動 or 選択 | ○ |
| 宛先部署 | 自動 or 選択 | ○ |
| 問い合わせ種別 | Lookup: IssueType | ○ |
| 要点 | 短文：1〜2行 | ○ |
| 決定事項/対応内容 | 箇条書き | - |
| 担当者 | 自由入力またはメール | - |
| 期限 | 任意 | - |
| 結果 | Lookup: Outcome | - |
| 優先度 | 高/中/低 | - |
| ステータス | Open/In Progress/Done/Canceled | ○ |
| 添付リンク | Drive URLなど | - |
| タグ | 任意 | - |

#### UX要件（可愛く・迷わない）

- 入力フォームはカード風（角丸）
- 選択式（プルダウン/チップ）を優先し、文章入力を最小に
- "保存"ボタンを大きく、1つに統一
- 保存後:
  - トースト「保存しました」
  - 履歴詳細へ遷移 or 履歴一覧の先頭に反映

#### 通話中メモ導線

- Meet生成直後に「メモを開く」ボタンを表示（別タブのMeetに移った後でも、元タブでメモが書ける前提）
- 可能なら「メモを別ウィンドウで開く（小さめ）」も用意（MVPでは通常タブでOK）

---

### 2-4. 画面C: 履歴一覧（History）

- 最新順に Session_Memos を一覧表示
- **1行カード表示:**
  - 日時 / 発信部署→宛先部署
  - 種別 / 要点（短く）
  - ステータス（色バッジ）
- **フィルタ:**
  - 部署（発信/宛先）
  - 種別
  - ステータス
  - 期間（今週/今月/任意）
- クリックで詳細（画面D）

---

### 2-5. 画面D: 履歴詳細（History Detail）

- Memo全文（決定事項/担当/期限/添付リンク）
- 関連event（Meet URLなど）へのリンク（必要なら）
- 編集（MVPでは「追記」だけでも可）
- "回覧用"のコピー（将来：簡易要約/共有リンク）

---

## 3. データ設計（Spreadsheet）

※ 既に用意したExcelテンプレに準拠。Googleスプレッドシートに変換して利用。

### 3-1. シート一覧

| シート名 | 説明 |
|----------|------|
| Dept_Master | 部署マスタ |
| Connection_Rules | 部署間ルール |
| Interaction_Log | イベントログ |
| Session_Memos | メモ |
| Lookup | プルダウン選択肢 |
| History_View | 将来：ビュー生成 |

### 3-2. 主要キー

| キー | 形式 | 説明 |
|------|------|------|
| dept_id | 英数・一意 | 例: mach_design |
| event_id | E000001 形式 | 自動採番 |
| memo_id | M000001 形式 | 自動採番 |

memo と event は `related_event_id` / `related_memo_id` で相互参照

### 3-3. ID採番方針

- PropertiesService（スクリプトプロパティ）に連番カウンタ保持
- 競合防止のため LockService を使用
- 例:
  - nextEventId: 1 → E000001
  - nextMemoId: 1 → M000001

---

## 4. バックエンド設計（GAS）

### 4-1. モジュール構成（推奨）

```
/Code.gs
  - doGet()
  - route()

/services/SheetService.gs
  - getDeptList()
  - getDeptById()
  - appendEventLog()
  - createMemo()
  - listMemos()
  - getMemoDetail()

/services/AuthService.gs
  - getCurrentUser()
  - assertAllowedUser()（必要ならドメイン制限）

/services/GoogleChatService.gs
  - postToSpace(spaceId, messagePayload)

/services/GoogleMeetService.gs
  - createMeetingSpace()

/ui/index.html
/ui/history.html
/ui/memo.html
/ui/styles.css
/ui/app.js
```

※ 実装は1ファイルでも可能だが、将来拡張のため分割を推奨。

---

## 5. API連携（Chat / Meet）

### 5-1. 大前提（現実）

- "電話みたいな強制着信"はしない/できない
- 参加は「通知→タップ」が基本
- 会話内容の全文記録はしない（要点メモで代替）

### 5-2. Google Chat

- 宛先部署の「通知先スペースID」へ、カード付きメッセージを送信
- カード内に:
  - 発信者名/発信部署
  - 用件入力促し（短文）
  - [Meetに参加] ボタン（meetingUri）
  - [メモを開く] ボタン（Webアプリ memo画面URLに event_id を付ける）

#### Chat通知テンプレ（案）

- **タイトル:** 「📣 連絡があります」
- **本文:** 「{発信部署} の {発信者} さんから連絡です」
- **ボタン:**
  - 「Meetに参加」
  - 「メモを見る/書く」

### 5-3. Google Meet

- Meet REST APIで会議スペース作成 → meetingUri取得
- 作成直後に event log を残す
- 生成した meetingUri は Interaction_Log に保存
- **"常設Meet"運用（将来/任意）:**
  - Dept_Master の `常設Meet URL` を優先使用

---

## 6. ルーティング/エンドポイント（Webアプリ）

### 6-1. doGetパラメータ

| パラメータ | 説明 |
|------------|------|
| `?page=home` | default: 部署一覧 |
| `?page=memo&event_id=E000001` | メモ入力 |
| `?page=history` | 履歴一覧 |
| `?page=detail&memo_id=M000001` | 履歴詳細 |

### 6-2. サーバー関数（google.script.run で呼ぶ）

| 関数 | 説明 |
|------|------|
| `getBootstrap()` | currentUser, deptList, lookup |
| `openChat(deptId)` | log event, return chatUrl |
| `createMeet(deptId, fromDeptId?)` | create meet, log event(s), notify target chat space, return {eventId, meetingUri, memoUrl} |
| `saveMemo(memoPayload)` | create memo row, update related event status (optional) |
| `listMemos(filters)` | return list |
| `getMemoDetail(memoId)` | return detail |

---

## 7. ログ/メモのルール

### 7-1. Interaction_Log（必須）

最低限、以下イベントを記録:

| イベント | 説明 |
|----------|------|
| OpenHome | ホーム画面表示 |
| OpenChat | Chatボタン押下 |
| CreateMeet | Meet作成 |
| NotifyChat | Chat通知送信 |
| OpenMemo | メモ画面表示 |
| SaveMemo | メモ保存 |
| OpenHistory | 履歴画面表示 |
| Error | 例外発生時 |

### 7-2. Session_Memos（重要）

- 会話全文ではなく「業務に必要な要点」を残す
- "短文＋テンプレ選択"で入力負荷を下げる
- ステータス管理（Open→In Progress→Done）を付与

---

## 8. UIデザイン仕様（かわいい・淡い・丸い）

### 8-1. カラーパレット

| 用途 | カラー | Hex |
|------|--------|-----|
| Base | 白 | #FFFFFF |
| Sky (淡い水色) | メイン | #D9F0FF |
| Sky (淡い水色) | アクセント | #A9D9FF |
| Lime (淡い黄緑) | メイン | #DFF7D6 |
| Lime (淡い黄緑) | アクセント | #AEE9A6 |
| Text | 濃いグレー | #1F2A37 |
| Border | 薄グレー | #E5E7EB |

※ Danger/Warningは強くしすぎない（淡い赤/黄）

### 8-2. コンポーネント

| コンポーネント | 仕様 |
|----------------|------|
| Card | radius 18px / padding 14〜16 |
| Button | radius 999px / 高さ44px（押しやすい） |
| Shadow | 0 6px 18px rgba(0,0,0,0.06) 程度 |
| Font | system-ui（日本語はOS標準でOK） |
| アイコン | 絵文字 or SVG（丸み） |

### 8-3. 操作性（工場向け）

- 片手操作想定（ボタン大きめ）
- 誤タップ防止の余白
- 読みやすい文字サイズ（16px以上推奨）

---

## 9. セキュリティ/権限

| 項目 | 設定 |
|------|------|
| Webアプリ公開設定 | 原則「組織内ユーザーのみ」 |
| 実行権限 | "ユーザーとして実行"が理想（誰が何をしたか監査が明確） |
| スプレッドシート | Dept_Master は編集者を限定（保護範囲） |
| ログ/メモ | GASのみ書き込み（ユーザーはUIから入力） |
| 個人情報 | 会話全文/音声の自動記録はしない |

---

## 10. 実装ステップ（コーディング順）

1. スプレッドシートをGoogle Sheets化（テンプレを基に）
2. コンテナバインドGAS作成（同一スプレッドシートに紐付け）
3. doGet + Home表示（Dept_Masterから部署一覧を出す）
4. Chatボタン: chatUrl遷移 + Interaction_Log記録
5. Memo画面: Session_Memos保存（テンプレ＋短文）
6. History画面: Session_Memos一覧/詳細
7. Meetボタン: Meet生成→Chat通知→meetingUri遷移→memo導線
8. エラー処理/ローディング/トースト/デザイン微調整
9. Connection_Rules活用（推奨表示など）※任意

---

## 11. 例外・エラーハンドリング

### API失敗時

- 画面に"やさしい言葉"で表示
  - 例: 「うまく接続できませんでした。もう一度お試しください」
- Interaction_Logに Error イベントを残す（error_code / message）

### 未設定

- ボタン無効 or ガイド表示

### スプレッドシート書き込み失敗

- リトライ1回
- それでも失敗なら「メモをコピーして退避してください」と案内（textareaに残す）

---

## 12. 受け入れ基準（MVP完了条件）

- [ ] Dept_Masterに登録された部署がHomeに表示される
- [ ] Chatボタンで対象Chatへ遷移でき、ログが残る
- [ ] MeetボタンでmeetingUriが生成され、宛先部署に通知が送れ、ログが残る
- [ ] Memo入力が保存でき、履歴一覧/詳細で見返せる
- [ ] UIが白ベース、淡い水色/黄緑、角丸で統一され、スマホでも押しやすい

---

## 13. コーディングエージェントへの具体指示（実装の要点）

- UIは "かわいい丸み" 最優先。CSSコンポーネント化（button/card/badge/input）
- 部署一覧は Dept_Master から取得し、`有効=Y` のみ表示、表示順でソート
- link紐づけは後付け前提:
  - chat_space_id/chat_url/notify_space_id が空でも落ちない
- ログは「できるだけ多く」残す（後で改善に効く）
- memoは"入力負荷最小":
  - IssueType/Outcome/Priority/StatusはLookupのプルダウン
  - 短文＋箇条書きが基本
- 履歴閲覧は "現場でも見れる":
  - 1画面で要点が分かるカードUI
  - ステータス色バッジ（淡色）
- すべての操作にローディング表示（くるくる）とトーストを付ける
- コードは SheetService を中心に、UIからの呼び出しを薄くする

---

## 14. 参考：文言トーン（やさしい日本語）

| 状況 | メッセージ例 |
|------|-------------|
| 準備中 | 「準備中です」/「まだ設定されていません」 |
| 成功 | 「保存しました」/「接続しています…」 |
| 失敗 | 「うまくいきませんでした。もう一度お試しください」 |

**"怒らない・責めない"メッセージで統一**

---

## 次のステップ

次の作業（コーディング開始）では、まず **Home（部署一覧） + Session_Memos保存 + History表示** を先に作り、その後に **Meet生成/Chat通知** をつなぐ手順が最短で安定します。
