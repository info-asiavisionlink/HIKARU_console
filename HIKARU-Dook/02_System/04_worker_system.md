# HIKARU-System 作業者システム仕様

## 概要

HIKARU-Systemは作業者（清掃員）がスマートフォンで現場業務を完結するためのWebアプリです（ポート3000）。  
スマートフォン片手操作を最優先に設計。

---

## 画面一覧（第5回実装済み）

| 画面名 | パス | 概要 |
|---|---|---|
| ホーム | /home | 今日の作業サマリー・案件クイックアクセス |
| 案件一覧 | /jobs | 全案件一覧・検索・ステータスフィルター |
| 案件詳細 | /jobs/[projectId] | 案件情報・進捗・作業開始/完了ボタン |
| Before写真 | /jobs/[projectId]/before | 撮影箇所ごとのBefore写真撮影 |
| After写真 | /jobs/[projectId]/after | Before比較表示 + After写真撮影 |
| マニュアル | /jobs/[projectId]/manual | 文章/FAQ/注意事項/PDF/画像/動画閲覧 |
| プロフィール | /profile | ユーザー情報・ログアウト |
| 通知 | /notifications | 既読管理・通知一覧 |

---

## 作業フロー

```
ホーム
  └─ 案件一覧 (/jobs)
      └─ 案件詳細 (/jobs/[projectId])
          ├─ マニュアル閲覧 (/manual)   ← いつでも参照可
          ├─ 作業開始ボタン
          │   └─ jobs レコード作成 (status: in_progress)
          │
          ├─ Before撮影 (/before)
          │   └─ 各撮影箇所を順に撮影 → Supabase Storage へ保存
          │   └─ 全箇所完了 → After撮影へ
          │
          ├─ After撮影 (/after)
          │   └─ Before画像と並べて表示 → After撮影
          │   └─ 全必須箇所完了 → 作業完了ボタン表示
          │
          └─ 作業完了
              └─ jobs.status = 'completed', completed_at = NOW()
```

---

## UI/UX 設計方針

| 項目 | 方針 |
|---|---|
| ボタンサイズ | 最小タップ領域 44px。主要アクションは py-4 (56px) |
| カメラ | `<input type="file" capture="environment">` でネイティブカメラを起動 |
| 進捗表示 | ヘッダー直下に常時表示。リアルタイムで更新 |
| 写真プレビュー | 撮影直後にローカルプレビューを表示。バックグラウンドでアップロード |
| 撮り直し | 撮影済み写真に「撮り直す」ボタンを常時表示 |
| エラー | 必須項目未撮影時は警告メッセージで残件数を表示 |
| After画面 | Before写真を横に並べて比較できるグリッドレイアウト |
| 完了要件 | 必須（is_required=true）の撮影箇所がすべてbefore+afterで揃った場合のみ完了可 |

---

## データフロー

```
作業者ログイン
  └─ profiles.role = 'worker'
  └─ ホーム画面へ

案件一覧表示
  └─ projects (status='active') を取得
  └─ 各 project の今日のジョブ (jobs where work_date=TODAY) を結合して表示

作業開始
  └─ jobs INSERT (project_id, worker_id, company_id, status='in_progress', work_date=TODAY)
  └─ 同日・同プロジェクトで既存ジョブがある場合はそれを使用（UNIQUE制約）

写真撮影
  └─ Supabase Storage (bucket: photos) に PUT
  └─ path: {job_id}/{type}/{spot_id}_{timestamp}.jpg
  └─ photos UPSERT (job_id, spot_id, photo_type) ← 再撮影で上書き

作業完了
  └─ jobs UPDATE (status='completed', completed_at=NOW())
```

---

## コンポーネント

| コンポーネント | パス | 機能 |
|---|---|---|
| PhotoCapture | components/worker/PhotoCapture.tsx | カメラ起動・プレビュー・撮り直し |
| WorkProgress | components/worker/WorkProgress.tsx | 進捗バー・SpotStatusDot |
| WorkerHeader | components/layouts/WorkerHeader.tsx | スティッキーヘッダー・戻るボタン |
| BottomNav | components/layouts/BottomNav.tsx | ホーム・案件・プロフィール |

---

## 必要なSupabase Storage設定

```
バケット名: photos
公開設定: Public（または署名URL）
フォルダ構造: {job_id}/{before|after}/{spot_id}_{timestamp}.jpg
```

ダッシュボード > Storage > New bucket から作成してください。

---

## 今後追加予定

- [ ] AI品質判定（Before/After比較評価）
- [ ] AIマニュアルチャット（RAG検索）
- [ ] 報告書自動生成・PDF出力
- [ ] オフライン対応（Service Worker + IndexedDB）
- [ ] リアルタイム進捗同期（Supabase Realtime）
- [ ] 作業スケジュール管理（カレンダー表示）
- [ ] 作業者GPS記録
