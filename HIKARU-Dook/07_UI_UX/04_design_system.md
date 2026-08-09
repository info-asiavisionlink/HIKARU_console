# HIKARU Design System — Cyber Luxury Edition v3.0

**コンセプト**: Black × Gold × Neon — AI品質マネジメントプラットフォーム  
**キーワード**: JARVIS · HUD · ホログラム · ラグジュアリー · Glass UI · Neon · Cyber Luxury  
**実装**: `packages/ui/src/` · CONSOLE/System両アプリ  
**更新**: 2026-08-02

---

## デザイン哲学

> "未来の高級業務システム" — 画面を開いた瞬間に「AI」「高級感」「未来」「信頼性」「ワクワク感」を伝える。

**参考**: Iron Man J.A.R.V.I.S., Tesla, Apple Vision Pro, Arc Browser, Linear, Vercel, Nothing Phone, Cyberpunk HUD, FUI (Future User Interface)

---

## カラーシステム

### ベースパレット

| トークン | oklch値 | 役割 |
|---------|--------|------|
| `--color-background` | `oklch(0.05 0.003 260)` | 漆黒 (メイン背景) |
| `--color-surface` | `oklch(0.09 0.005 255 / 0.85)` | ブラックガラス (カード) |
| `--color-surface-raised` | `oklch(0.12 0.007 255 / 0.90)` | 上位レイヤー |
| `--color-foreground` | `oklch(0.95 0.008 75)` | ウォームホワイト (テキスト) |
| `--color-muted-foreground` | `oklch(0.60 0.010 75)` | ゴールドティントグレー |

### ゴールド (プライマリブランド)

| トークン | oklch値 | 用途 |
|---------|--------|------|
| `--color-gold` | `oklch(0.73 0.12 78)` | メインゴールド |
| `--color-gold-light` | `oklch(0.85 0.13 78)` | ハイライト |
| `--color-gold-dark` | `oklch(0.52 0.10 75)` | シャドウ/暗部 |
| `--color-primary` | `oklch(0.73 0.12 78)` | ゴールド (primaryエイリアス) |

**Goldグラデーション** (ボタン・ロゴ):
```css
linear-gradient(135deg,
  oklch(0.52 0.10 75) 0%,
  oklch(0.73 0.12 78) 50%,
  oklch(0.90 0.10 80) 60%,
  oklch(0.73 0.12 78) 100%
)
```

### ネオンアクセント

| トークン | oklch値 | 用途 |
|---------|--------|------|
| `--color-neon-cyan` | `oklch(0.85 0.18 198)` | AI機能・生成フェーズ |
| `--color-neon-blue` | `oklch(0.60 0.28 260)` | インタラクション |
| `--color-accent` | `oklch(0.60 0.28 260)` | neon-blueエイリアス |

### セマンティック

| 状態 | oklch値 |
|------|---------|
| Success | `oklch(0.72 0.18 150)` |
| Warning | `oklch(0.78 0.18 75)` |
| Error | `oklch(0.65 0.25 27)` |
| Info | `oklch(0.68 0.20 230)` |

### Glow変数

```css
--glow-gold:  0 0 20px oklch(0.73 0.12 78/0.55), 0 0 60px oklch(0.73 0.12 78/0.20);
--glow-cyan:  0 0 20px oklch(0.85 0.18 198/0.55), 0 0 60px oklch(0.85 0.18 198/0.20);
--glow-blue:  0 0 20px oklch(0.60 0.28 260/0.55), 0 0 60px oklch(0.60 0.28 260/0.20);
--glow-green: 0 0 20px oklch(0.72 0.18 150/0.55), 0 0 60px oklch(0.72 0.18 150/0.20);
```

---

## タイポグラフィ

| レベル | サイズ | Weight | 特記 |
|--------|------|--------|------|
| ラベル (マイクロ) | 9-10px | 700 | `tracking-[0.25em] uppercase` — セクション区切り |
| キャプション | 12px | 400 | サブ情報 |
| ボディ | 14px | 400 | 本文 |
| サブヘッダー | 14px | 600 | `tracking-wide` |
| ページタイトル | 24px | 700 | `tracking-tight` |
| 数値・KPI | 36-48px | 900 | Goldグラデーション + tabular-nums |

**日本語**: Hiragino Kaku Gothic ProN → Hiragino Sans → system-ui

---

## 余白ルール

| 場所 | 値 |
|------|---|
| ページpadding | `p-6` (24px) |
| カード内padding | `px-5 py-4` (20px) |
| カード間gap | `gap-4` (16px) |
| セクション間 | `mt-6`〜`mt-8` |
| コーナーブラケット | top/left/right/bottom: 12-16px |

---

## ボーダー半径

| トークン | 値 | 用途 |
|---------|---|------|
| `--radius` | 8px | ボタン・入力 |
| `--radius-lg` | 12px | カード |
| `--radius-xl` | 16px | モーダル・LoginCard |
| `--radius-full` | 9999px | バッジ・アバター・ドット |

---

## Glass Morphism

### 標準 (カード・パネル)
```css
background: oklch(0.09 0.005 255 / 0.80);
backdrop-filter: blur(24px) saturate(1.4);
border: 1px solid oklch(0.73 0.12 78 / 0.18);
```

### Goldガラス (強調カード・ログイン)
```css
background: oklch(0.10 0.006 255 / 0.82);
backdrop-filter: blur(24px) saturate(1.5);
border: 1px solid oklch(0.73 0.12 78 / 0.35);
box-shadow: 0 0 30px oklch(0.73 0.12 78/0.08), inset 0 1px 0 oklch(0.85 0.13 78/0.12);
```

### モーダル (最強)
```css
background: oklch(0.10 0.006 255 / 0.95);
backdrop-filter: blur(40px) saturate(1.8);
border: 1px solid oklch(0.73 0.12 78 / 0.30);
```

Tailwindユーティリティ: `.glass` / `.glass-gold` / `.glass-strong`

---

## シャドウ

全shadow にgold micro-glow:
```css
--shadow-md: 0 5px 20px rgb(0 0 0/0.60), 0 0 40px oklch(0.73 0.12 78/0.08);
--shadow-lg: 0 10px 35px rgb(0 0 0/0.65), 0 0 60px oklch(0.73 0.12 78/0.10);
```

---

## カードデザイン

### HUDスタットカード
```
┌──────────────────────────────────────┐  ← Gold border 0.20 opacity
│ ↖ corner            corner ↗         │  ← HUDコーナーブラケット
│                                      │
│ LABEL (9px gold uppercase)           │
│ 42px GOLD GRADIENT NUMBER            │
│ sub text                             │
│                          → (hover)   │
└──────────────────────────────────────┘
hover: translateY(-3px) + gold border強化 + glow
```

### Gold背景の場合
```
background: radial-gradient top-right gold/0.06
```

---

## ボタンデザイン

| バリアント | 説明 |
|---------|------|
| `default` | Gold gradient + gold glow shadow |
| `outline` | Gold border + gold muted bg |
| `secondary` | Glass dark + thin gold border |
| `ghost` | 透明 → hover: glass |
| `neon` | Neon cyan背景 (AI専用CTA) |
| `destructive` | Error glass + error glow |
| `success` | Success glass + success glow |

---

## 入力フォームデザイン

```
ラベル: 9px gold/0.80, uppercase tracking-[0.2em]
┌─────────────────────────┐
│ 入力テキスト            │  ← border: gold/0.20
└─────────────────────────┘
hover: gold/0.35
focus: gold/0.60 border + glow shadow 16px + bg-raised
error: error border + error glow
```

---

## アイコンルール

- **ライブラリ**: Lucide React
- **アクティブglow**: `filter: drop-shadow(0 0 4px <gold_color>)`
- **サイズ**: h-4 w-4 (標準), h-5 w-5 (アクション)
- **型定義**: `React.ComponentType<{ className?: string; style?: React.CSSProperties }>`

---

## React Three Fiber 3D Background

**ファイル**: `packages/ui/src/components/r3f-background.tsx`

| 要素 | 説明 |
|------|------|
| `ParticleField` | Gold/Cyan/Blue 800粒子、ゆっくり回転 |
| `GridLines` | Gold wireframe 3Dグリッド、傾いて回転 |
| `EnergyRings` | Gold/Cyan/Blue 3Dリング、独立回転 |
| `FloatingLines` | 放射状エネルギーライン |
| `CameraRig` | マウスで緩やかにカメラが追従 |

**設定**:
```tsx
<R3FBackground />  // ConsoleLayoutに統合済み
// Canvas: alpha, powerPreference:'low-power', dpr:[1,1.5]
```

**パフォーマンス**:
- `powerPreference: 'low-power'` でGPU節約
- dpr最大1.5でレンダリング負荷制御
- `position: fixed; z-index: -1` で業務操作の邪魔なし

---

## GSAPアニメーション

```tsx
import { gsap } from 'gsap'

// ページ登場 (useLayoutEffect内)
gsap.from('.page-content', { opacity: 0, y: 10, duration: 0.5, ease: 'power2.out' })

// カード stagger
gsap.from('.stat-card', { opacity: 0, y: 16, stagger: 0.07, duration: 0.4, ease: 'power2.out' })

// 数字カウントアップ
const obj = { val: 0 }
gsap.to(obj, { val: target, duration: 1.5, ease: 'power3.out', snap: { val: 1 },
  onUpdate: () => { element.textContent = Math.round(obj.val).toLocaleString() }
})

// モーダル登場
gsap.from(modal, { scale: 0.94, opacity: 0, duration: 0.28, ease: 'back.out(1.7)' })
```

**ease原則**: `power2.out` (標準), `back.out(1.7)` (モーダル), `power3.out` (数値)

---

## Framer Motion

```tsx
// Hover + Tap
<motion.div
  whileHover={{ y: -3, boxShadow: '0 0 30px oklch(0.73 0.12 78/0.20)' }}
  whileTap={{ scale: 0.97 }}
  transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
>

// リスト stagger
const container = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.07, delayChildren: 0.1 } }
}
const item = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] } }
}
```

---

## AIスキャン演出 (フェーズ別)

| フェーズ | 色 | 演出 |
|---------|---|------|
| `scanning` | Neon Blue `oklch(0.68 0.20 230)` | スキャン波形 |
| `analyzing` | Gold `oklch(0.73 0.12 78)` | AI解析波形 + gold glow |
| `generating` | Neon Cyan `oklch(0.85 0.18 198)` | 生成波形 + cyan glow |
| `complete` | Green `oklch(0.72 0.18 150)` | チェックマーク |

```tsx
<AIScanner phase="analyzing" active />         // 波形のみ
<AIThinking />                                 // フェードテキスト
<AIHologram phase="analyzing" message="解析中" />  // フル演出 (回転リング+波形)
```

---

## コンポーネント一覧

| コンポーネント | 用途 |
|-------------|------|
| `Card` | glass morphism + glow variants (gold/cyan/blue) |
| `Button` | gold gradient / outline / neon variants |
| `Input` | dark + gold focus glow |
| `Badge` | gold/neon/success/error neon badges |
| `StatusBadge` | ジョブ/案件ステータス gold/green/error |
| `ScoreBadge` | AI品質スコア (gold=要確認, green=合格, red=再清掃) |
| `Skeleton` | gold shimmer dark version |
| `Spinner` | gold/cyan/white glow ring |
| `AILoader` | 3Dリング AI処理ローダー |
| `AIScanner` | 波形スキャン演出 |
| `AIThinking` | フェードテキスト演出 |
| `AIHologram` | 回転リング + 波形フル演出 |
| `R3FBackground` | React Three Fiber 3D背景 |
| `HudBackground` | Canvas 2D パーティクル背景 (フォールバック) |
| `PageHeader` | Gold accent line + gradient title |
| `SearchBar` | dark + gold focus glow |
| `Table` | dark glass + gold header |
| `Dialog` | glass gold modal + corner brackets |
| `DropdownMenu` | dark glass menu |
| `Select` | dark glass select |
| `Avatar` | gold border |

---

## 新規画面チェックリスト

- [ ] `animate-[fade-in_0.5s_ease-out]` でページ登場アニメーション
- [ ] `PageHeader` コンポーネント使用 (gold accent line付き)
- [ ] カードは glass style (`.glass` or `.glass-gold`)
- [ ] 数値は Goldグラデーション + tabular-nums
- [ ] ラベルは `9-10px uppercase tracking-[0.25em]` gold/0.65
- [ ] HUDコーナーブラケット (重要カード)
- [ ] AI機能は `AIScanner` / `AIThinking` / `AIHologram` 使用
- [ ] hover時は `translateY(-3px)` + border/glow強化

---

## アクセシビリティ

- `:focus-visible`: gold glow outline
- カラーコントラスト: 暗背景+明テキスト (WCAG AA準拠)
- 3D/Canvas要素: `aria-hidden="true"` + `pointer-events-none`
- フォーム: `label` + `htmlFor` 必須

---

*HIKARU Cyber Luxury Design System v3.0 — Black × Gold × Neon*
