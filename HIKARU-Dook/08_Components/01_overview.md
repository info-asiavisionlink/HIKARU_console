# コンポーネント設計

## 概要

HIKARUのすべてのUIコンポーネントは `packages/ui`（`@hikaru/ui`）として一元管理されます。  
両アプリ（HIKARU-System / HIKARU-CONSOLE）はこのパッケージを参照します。

---

## コンポーネント一覧

### プリミティブ（Primitives）
| コンポーネント | ファイル | 説明 |
|---|---|---|
| Button | `button.tsx` | 7バリアント・6サイズ・loading対応 |
| Input | `input.tsx` | ラベル・エラー・アイコン対応 |
| Textarea | `textarea.tsx` | ラベル・エラー・リサイズ対応 |
| Select | `select.tsx` | Radix UI Select ベース |
| Checkbox | `checkbox.tsx` | Radix UI Checkbox ベース |
| RadioGroup | `radio-group.tsx` | Radix UI RadioGroup ベース |
| Switch | `switch.tsx` | Radix UI Switch ベース |
| Separator | `separator.tsx` | 水平・垂直区切り線 |

### レイアウト（Layout）
| コンポーネント | ファイル | 説明 |
|---|---|---|
| Card / CardHeader / CardContent / CardFooter | `card.tsx` | hoverable・clickable対応 |

### 表示（Display）
| コンポーネント | ファイル | 説明 |
|---|---|---|
| Badge | `badge.tsx` | 7バリアント・3サイズ |
| Avatar / AvatarFallback | `avatar.tsx` | Radix UI Avatar ベース・5サイズ |

### ナビゲーション（Navigation）
| コンポーネント | ファイル | 説明 |
|---|---|---|
| Tabs / UnderlineTabs | `tabs.tsx` | ピル型・アンダーライン型の2スタイル |
| Accordion | `accordion.tsx` | Radix UI Accordion ベース |
| Breadcrumb | `breadcrumb.tsx` | アイテム配列から自動生成 |
| Pagination | `pagination.tsx` | ページネーション（省略表示対応） |

### オーバーレイ（Overlay）
| コンポーネント | ファイル | 説明 |
|---|---|---|
| Dialog | `dialog.tsx` | Radix UI Dialog・フォーカストラップ・ESCキー対応 |
| Drawer | `drawer.tsx` | left/right/bottom 3方向対応 |
| Tooltip | `tooltip.tsx` | Radix UI Tooltip ベース |
| DropdownMenu | `dropdown-menu.tsx` | Radix UI DropdownMenu ベース |

### フィードバック（Feedback）
| コンポーネント | ファイル | 説明 |
|---|---|---|
| Alert | `alert.tsx` | default/info/success/warning/error |
| Spinner / FullPageLoading / LoadingOverlay | `loading.tsx` | 3種のローディング表示 |
| Skeleton / SkeletonText / SkeletonCard | `skeleton.tsx` | シマー アニメーション |
| toast / Toaster | `toast.tsx` | sonner ライブラリ使用 |

### データ（Data）
| コンポーネント | ファイル | 説明 |
|---|---|---|
| TableWrapper / Table / TableRow / TableCell... | `table.tsx` | スクロール対応テーブル |

### HIKARUビジネスコンポーネント
| コンポーネント | ファイル | 説明 |
|---|---|---|
| ScoreBadge / ScoreDisplay | `score-badge.tsx` | 品質スコア表示（合格/要確認/再清掃） |
| StatusBadge | `status-badge.tsx` | 作業・案件ステータス表示 |
| PageHeader / SectionHeader | `page-header.tsx` | ページ・セクション見出し |
| SearchBar | `search-bar.tsx` | クリアボタン付き検索フィールド |

---

## レイアウトコンポーネント（アプリ固有）

### HIKARU-System
| コンポーネント | パス | 説明 |
|---|---|---|
| WorkerLayout | `components/layouts/WorkerLayout.tsx` | ボトムナビ + Toast Provider |
| BottomNav | `components/layouts/BottomNav.tsx` | 作業者向けボトムナビゲーション |
| WorkerHeader | `components/layouts/WorkerHeader.tsx` | 戻るボタン付きモバイルヘッダー |

### HIKARU-CONSOLE
| コンポーネント | パス | 説明 |
|---|---|---|
| ConsoleLayout | `components/layouts/ConsoleLayout.tsx` | サイドバー + ヘッダー + Toast Provider |
| Sidebar | `components/layouts/Sidebar.tsx` | 折りたたみ対応サイドバー |
| ConsoleHeader | `components/layouts/ConsoleHeader.tsx` | 通知・ユーザーメニュー付きヘッダー |

---

## 技術基盤

| ライブラリ | 用途 |
|---|---|
| `@radix-ui/*` | アクセシブルなヘッドレスプリミティブ |
| `class-variance-authority` | バリアント管理（CVA） |
| `clsx` + `tailwind-merge` | className結合 |
| `lucide-react` | アイコン |
| `sonner` | Toast通知 |

---

## 使用方法

```typescript
import { Button, Card, CardContent, ScoreBadge, toast } from '@hikaru/ui'

// ボタン
<Button variant="default" size="default" loading={false}>
  送信
</Button>

// スコアバッジ
<ScoreBadge score={87} showLabel />

// Toast通知
toast.success('報告書を提出しました')
toast.error('エラーが発生しました')
```

---

## 追加ルール

1. 新コンポーネントは `packages/ui/src/components/` に追加
2. 追加後は `packages/ui/src/index.ts` にエクスポートを追加
3. 本ドキュメント（コンポーネント一覧）を更新する
4. アプリ固有のコンポーネントは各アプリの `components/features/` に配置
