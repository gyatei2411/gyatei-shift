# ぎゃあてい シフト調整アプリ

「調整さん」風のシフト希望調整 + Excel自動出力 Webアプリ。
スタッフがLINEから○/△/✕と希望時刻を入力 → 管理者画面に**自動集約** → ボタン1つでテンプレ準拠の `シフト_MMDD.xlsx` を生成。

## ファイル構成

| ファイル | 役割 |
|---|---|
| `admin.html` | 管理者画面（依頼作成・集計・スタッフ管理） |
| `reply.html` | スタッフ用回答画面（LINEで開く） |
| `shared.js` | 共通ロジック（Firebase / localStorage 切替） |
| `xlsx-export.js` | xlsx生成ロジック（SheetJS） |
| `firebase-config.js` | Firebase接続情報（自分で編集） |
| `style.css` | 共通スタイル |

## セットアップ手順（一回だけ）

### Step 1. GitHub アカウントとリポジトリ作成

1. https://github.com にアクセス → アカウント作成
2. 右上の `+` → **New repository**
3. Repository name: `gyatei-shift`（任意）
4. **Public** を選択
5. **Create repository**

### Step 2. ファイルをアップロード

1. リポジトリ画面で **uploading an existing file** をクリック
2. 以下のファイルをドラッグ＆ドロップ:
   - `admin.html`
   - `reply.html`
   - `shared.js`
   - `xlsx-export.js`
   - `firebase-config.js`
   - `style.css`
3. **Commit changes**

### Step 3. GitHub Pages を有効化

1. リポジトリの **Settings** タブ → 左メニュー **Pages**
2. Source: **Deploy from a branch**
3. Branch: **main** / Folder: **/ (root)** → **Save**
4. 数分待つと `https://<ユーザー名>.github.io/gyatei-shift/admin.html` でアクセス可能になる

これでスタッフのスマホからもアクセスできます。
ただし、この時点では「**回答自動集約は未設定**」です（手動URL貼り付けモードで動作）。

### Step 4. Firebase 設定（自動集約を使うなら）

1. https://console.firebase.google.com にGoogleアカウントでログイン
2. **プロジェクトを追加** → 名前 `gyatei-shift` → Google Analytics は無効でOK → 作成
3. 左メニューから **Realtime Database** → **データベースを作成**
   - ロケーション: **asia-southeast1（シンガポール）**
   - **テストモードで開始** を選択
4. データベース作成後、上の **ルール** タブを開いて以下を貼り付け → **公開**

   ```json
   {
     "rules": {
       "requests": {
         "$reqId": {
           ".read": true,
           ".write": true
         }
       },
       "replies": {
         "$reqId": {
           ".read": true,
           ".write": true
         }
       }
     }
   }
   ```

5. 左上の歯車 → **プロジェクトの設定** → 下の方の **アプリ** → `</>` ウェブアプリ追加
6. アプリ名 `shift-app` → 登録 → 出てきた `firebaseConfig` の中身をコピー
7. ローカルの `firebase-config.js` を編集（以下のように6項目を貼り付け）

   ```js
   const FIREBASE_CONFIG = {
     apiKey: "AIzaSy...",
     authDomain: "gyatei-shift.firebaseapp.com",
     databaseURL: "https://gyatei-shift-default-rtdb.asia-southeast1.firebasedatabase.app",
     projectId: "gyatei-shift",
     storageBucket: "gyatei-shift.appspot.com",
     messagingSenderId: "123456789",
     appId: "1:123456789:web:abc123"
   };
   ```

8. 編集した `firebase-config.js` を GitHub にアップロード（既存ファイルを差し替え）
9. 数分待ってから `admin.html` を再読込 → 右上が「🟢 オンライン同期」になればOK

## 普段の運用フロー

### 管理者: 依頼作成

1. `https://<ユーザー名>.github.io/gyatei-shift/admin.html` を開く
2. 「① 依頼作成」タブで対象週を選択 → **依頼URLを生成**
3. **LINEで送る** ボタン or URLコピーでスタッフ全員に送信

### スタッフ: 回答

1. LINEで届いたリンクをタップ
2. 名前を選択 → 7日分に ○ / △ / ✕ をタップ
3. ○ または △ を選んだ日には希望時刻が入力できる（任意）
4. **送信する** → 自動で管理者画面に届く（オンライン時）
   オフラインモードの場合は出てきたURLをLINEで送り返す

### 管理者: 集計＆Excel出力

1. 「② 集計＆Excel出力」タブで対象の依頼を選ぶ
2. リアルタイムで全員の回答が表示される（オンライン時）
3. 全員揃ったら **📥 Excelダウンロード** で `シフト_MMDD.xlsx` が落ちる
4. ダウンロード先: `<デスクトップ>/シフト_MMDD.xlsx`

## Excel出力の構造

テンプレ `シフト表.xlsx` 準拠:

- 各曜日3列ブロック、1スタッフ=2行ペア
- **上段の3列目（D/G/J/M/P/S/V）**: スタッフの希望時刻 ← Web入力で自動埋め
- **下段の3列目（D/G/J/M/P/S/V）**: ○ / △ / ✕ ← Web入力で自動埋め
- 上段の1〜2列目（始業・終業）と下段の1〜2列目（サブ・メインポジション）は管理者が後で手書き
- 末尾の備考行に全体備考を集約

## トラブルシューティング

- **依頼URLを開いても何も表示されない**: URLが切れている可能性。別の方法（コピペなど）で送り直す
- **Firebase設定後も「⚪ ローカル」のまま**: `firebase-config.js` の `databaseURL` が空でないか確認。ブラウザのキャッシュをクリア（Ctrl+Shift+R）
- **回答が同期されない**: Firebase コンソールで Realtime Database の **ルール** が公開されているか確認

## バックアップ

管理者画面の右上 **💾 書出** で、いつでも全データをJSONファイルにバックアップできます。
復元は **📥 復元**。

## ローカル動作（Firebase なし）

`firebase-config.js` の `databaseURL` を空のままにすると、自動集約なしの「localStorage モード」で動きます。
スタッフ→管理者間は**手動URL貼り付け**になりますが、最低限の動作確認はこれで可能。
