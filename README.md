# stress-check｜職業性ストレス簡易調査票

職業性ストレス簡易調査票（新職業性ストレス簡易調査票）のWebアプリです。
個人・企業向けにオンラインで受験・結果確認・PDF出力ができます。

## 公開URL
https://stress-check-gamma.vercel.app

## 機能
- 141問のストレスチェック（8セクション・49スケール）
- 自動採点・グラフ表示・全国平均との比較（偏差値ベース）
- 高ストレス判定・面接指導案内
- PDF出力
- 企業向け：会社コード付きURLで受験管理

## ファイル構成

### ルート
| ファイル | 役割 |
|---|---|
| index.html | 受験画面。141問のストレスチェック本体 |
| result.html | 受験後の結果表示画面。偏差値グラフ・PDF出力 |
| register.html | 受験者の登録画面 |
| vercel.json | Vercelのデプロイ・URLルーティング設定 |

### admin/
| ファイル | 役割 |
|---|---|
| login.html | 管理者ログイン画面 |
| signup.html | 企業の新規登録画面 |
| dashboard.html | 管理者トップ。受験者一覧・回収状況 |
| links.html | 受験用URLの発行・管理 |
| reset-password.html | パスワードリセット画面 |
| stress_check_group_analysis.html | 集団分析結果。偏差値グラフ・49スケール表示 |

### js/
| ファイル | 役割 |
|---|---|
| questions.js | 141問の質問データ |
| supabase-client.js | Supabaseへの接続設定 |

### supabase/
| ファイル | 役割 |
|---|---|
| schema.sql | データベースのテーブル定義 |
| patch_01_link_function.sql | DB機能の追加パッチ |

## 技術スタック
- フロントエンド：HTML / JavaScript（単一ファイル構成）
- データベース：Supabase
- ホスティング：Vercel（GitHubと連携、pushで自動デプロイ）

## 今後の予定
- [ ] 57問版の追加
- [ ] 個人受験者向け一般公開画面
- [ ] AIアドバイス・壁打ち機能（有料）
- [ ] 集団分析へのJD-Rモデル図解の組み込み
