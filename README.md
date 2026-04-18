# stress-check｜職業性ストレス簡易調査票

職業性ストレス簡易調査票（新職業性ストレス簡易調査票）のWebアプリです。
個人・企業向けにオンラインで受験・結果確認・PDF出力ができます。

## 公開URL
https://stress-check-gamma.vercel.app

## 機能
- 141問のストレスチェック（8セクション・49スケール）
- 自動採点・グラフ表示・全国平均との比較
- 高ストレス判定・面接指導案内
- PDF出力
- 企業向け：会社コード付きURLで受験管理（開発中）

## 構成
| ファイル/フォルダ | 役割 |
|---|---|
| index.html | メイン受験画面 |
| register.html | 受験者登録画面 |
| js/questions.js | 141問の質問データ |
| js/supabase-client.js | Supabaseデータベース接続 |
| admin/ | 管理者画面 |
| supabase/ | DBスキーマ・設定 |
| vercel.json | Vercelデプロイ設定 |

## 技術スタック
- フロントエンド：HTML / JavaScript（単一ファイル構成）
- データベース：Supabase
- ホスティング：Vercel（GitHubと連携、pushで自動デプロイ）

## 今後の予定
- [ ] 57問版の追加
- [ ] 個人受験者向け一般公開画面
- [ ] 企業向け管理画面の強化
