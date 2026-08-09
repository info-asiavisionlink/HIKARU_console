-- ============================================================
-- HIKARU: テストデータ — 定期案件10件 / ホテル案件10件
--   company_id = 00000000-0000-0000-0000-000000000001
-- ============================================================

DO $$
DECLARE
  cid  UUID := '00000000-0000-0000-0000-000000000001';

  -- 既存クライアント
  cl1  UUID := 'f1e3a965-10d5-43af-8560-7952b0159a2f'; -- 株式会社アルファビル管理
  cl2  UUID := '9c133536-5d49-4cd2-b830-2bf0b58155d4'; -- グリーンヒルズマンション管理組合
  cl3  UUID := '5b64049a-d190-4cfc-b707-4428e373eadb'; -- 医療法人桜会 さくら総合病院
  cl4  UUID := 'bf1ec0e6-0b1a-4120-86c0-22ed59c46cfb'; -- 日本精密工業株式会社
  cl5  UUID := 'ff52444b-7c31-41ed-81d2-d0e1f60d072c'; -- 学校法人東洋学園

  -- 案件ID（定期）
  r1 UUID; r2 UUID; r3 UUID; r4 UUID; r5 UUID;
  r6 UUID; r7 UUID; r8 UUID; r9 UUID; r10 UUID;

  -- 案件ID（ホテル）
  h1 UUID; h2 UUID; h3 UUID; h4 UUID; h5 UUID;
  h6 UUID; h7 UUID; h8 UUID; h9 UUID; h10 UUID;

BEGIN

-- ============================================================
-- 1. 定期案件 10件
-- ============================================================

INSERT INTO public.projects (company_id, name, project_type, status, location_name, start_date, end_date, client_id, notes)
VALUES
  (cid, 'アルファビル 定期清掃',       'recurring', 'active',    '東京都新宿区西新宿2-8-1',    '2025-04-01', '2026-03-31', cl1, '月次定期清掃。毎月第1月曜日実施。'),
  (cid, '品川オフィスタワー 定期清掃', 'recurring', 'active',    '東京都品川区大崎1-11-1',     '2025-01-01', '2025-12-31', cl1, '隔週清掃。床洗浄・ワックス中心。'),
  (cid, 'グリーンヒルズMB棟 定期清掃', 'recurring', 'active',    '神奈川県横浜市中区山下町21',  '2024-07-01', '2025-06-30', cl2, 'マンション共用部の月次清掃。'),
  (cid, 'さくら総合病院 定期清掃',     'recurring', 'active',    '東京都目黒区目黒本町4-15-2', '2025-04-01', '2026-03-31', cl3, '病院仕様。消毒・感染対策を重視。'),
  (cid, '日本精密工業 工場清掃',       'recurring', 'active',    '埼玉県川越市南大塚3-40-1',   '2025-01-01', '2025-12-31', cl4, '工場内床面。週次実施。'),
  (cid, '東洋学園 校舎定期清掃',       'recurring', 'active',    '東京都文京区千石4-39-24',    '2025-04-01', '2026-03-31', cl5, '学校清掃。授業後の夕方作業。'),
  (cid, '渋谷スクランブルスクエア 清掃', 'recurring', 'active',  '東京都渋谷区渋谷2-24-12',    '2025-06-01', '2026-05-31', NULL, '商業施設定期清掃。毎日実施。'),
  (cid, '横浜ランドマークタワー 清掃', 'recurring', 'active',    '神奈川県横浜市西区みなとみらい2-2-1','2025-03-01','2026-02-28',NULL,'高層ビル。エレベーターホール重点。'),
  (cid, '大宮ソニックシティ 清掃',     'recurring', 'paused',    '埼玉県さいたま市大宮区桜木町1-7-5','2024-10-01','2025-09-30',NULL,'現在一時停止中。再開予定あり。'),
  (cid, '千葉ポートスクエア 清掃',     'recurring', 'completed', '千葉県千葉市中央区問屋町1-45', '2024-04-01','2025-03-31',NULL,'契約終了。良好な関係を維持。');

-- IDを個別に取得
SELECT id INTO r1  FROM public.projects WHERE name = 'アルファビル 定期清掃'          AND company_id = cid;
SELECT id INTO r2  FROM public.projects WHERE name = '品川オフィスタワー 定期清掃'    AND company_id = cid;
SELECT id INTO r3  FROM public.projects WHERE name = 'グリーンヒルズMB棟 定期清掃'    AND company_id = cid;
SELECT id INTO r4  FROM public.projects WHERE name = 'さくら総合病院 定期清掃'        AND company_id = cid;
SELECT id INTO r5  FROM public.projects WHERE name = '日本精密工業 工場清掃'          AND company_id = cid;
SELECT id INTO r6  FROM public.projects WHERE name = '東洋学園 校舎定期清掃'          AND company_id = cid;
SELECT id INTO r7  FROM public.projects WHERE name = '渋谷スクランブルスクエア 清掃'  AND company_id = cid;
SELECT id INTO r8  FROM public.projects WHERE name = '横浜ランドマークタワー 清掃'    AND company_id = cid;
SELECT id INTO r9  FROM public.projects WHERE name = '大宮ソニックシティ 清掃'        AND company_id = cid;
SELECT id INTO r10 FROM public.projects WHERE name = '千葉ポートスクエア 清掃'        AND company_id = cid;

-- ── recurring_project_details
INSERT INTO public.recurring_project_details (project_id, cycle_type, cycle_config, work_start_time, work_end_time, required_staff)
VALUES
  (r1,  'monthly',    '{"day": 1}',              '09:00', '13:00', 3),
  (r2,  'biweekly',   '{"weekday": 1}',           '08:00', '12:00', 2),
  (r3,  'monthly',    '{"day": 15}',              '10:00', '14:00', 2),
  (r4,  'weekly',     '{"weekdays": [2,4]}',      '17:00', '21:00', 4),
  (r5,  'weekly',     '{"weekdays": [1,3,5]}',    '06:00', '08:00', 2),
  (r6,  'weekly',     '{"weekdays": [1,2,3,4,5]}','16:00', '19:00', 5),
  (r7,  'daily',      '{}',                       '22:00', '02:00', 6),
  (r8,  'monthly',    '{"day": 10}',              '09:00', '15:00', 4),
  (r9,  'biweekly',   '{"weekday": 3}',           '09:00', '13:00', 3),
  (r10, 'monthly',    '{"day": 20}',              '09:00', '12:00', 2);

-- ── recurring_monthly_schedules（12ヶ月分）
-- r1: アルファビル
INSERT INTO public.recurring_monthly_schedules (project_id, month, work_content) VALUES
  (r1,  1,  '床洗浄・ワックス（全フロア）、ガラス清掃'),
  (r1,  2,  '床洗浄・ワックス（全フロア）、トイレ重点清掃'),
  (r1,  3,  '床洗浄・ワックス、春季大掃除（ブラインド・エアコンフィルター）'),
  (r1,  4,  '床洗浄・ワックス（全フロア）、ガラス清掃'),
  (r1,  5,  '床洗浄・ワックス（全フロア）、共用部消毒'),
  (r1,  6,  '床洗浄・ワックス、梅雨対策（玄関マット・排水溝清掃）'),
  (r1,  7,  '床洗浄・ワックス（全フロア）、ガラス清掃'),
  (r1,  8,  '床洗浄・ワックス（全フロア）、エアコン清掃'),
  (r1,  9,  '床洗浄・ワックス（全フロア）、ガラス清掃'),
  (r1, 10,  '床洗浄・ワックス、秋季大掃除（カーペット洗浄）'),
  (r1, 11,  '床洗浄・ワックス（全フロア）、ガラス清掃'),
  (r1, 12,  '床洗浄・ワックス（全フロア）、年末大掃除（全エリア徹底清掃）');

-- r2: 品川オフィスタワー
INSERT INTO public.recurring_monthly_schedules (project_id, month, work_content) VALUES
  (r2,  1,  'カーペット洗浄・除菌、ガラス拭き'),
  (r2,  2,  'カーペット洗浄・除菌、トイレ・洗面台重点清掃'),
  (r2,  3,  'カーペット洗浄、春季エアコンフィルター清掃'),
  (r2,  4,  'カーペット洗浄・除菌、ガラス拭き'),
  (r2,  5,  'カーペット洗浄・除菌、共用部スポット清掃'),
  (r2,  6,  'カーペット洗浄、雨季対応（玄関・エントランス重点）'),
  (r2,  7,  'カーペット洗浄・除菌、ガラス拭き'),
  (r2,  8,  'カーペット洗浄・除菌、夏季エアコン・換気口清掃'),
  (r2,  9,  'カーペット洗浄・除菌、ガラス拭き'),
  (r2, 10,  'カーペット洗浄、秋季照明器具清掃'),
  (r2, 11,  'カーペット洗浄・除菌、ガラス拭き'),
  (r2, 12,  'カーペット洗浄・除菌、年末大掃除（全エリア）');

-- r3: グリーンヒルズMB棟
INSERT INTO public.recurring_monthly_schedules (project_id, month, work_content) VALUES
  (r3,  1,  '共用廊下床清掃・ワックス、エントランス清掃'),
  (r3,  2,  '共用廊下床清掃、ポスト周辺・掲示板清掃'),
  (r3,  3,  '共用廊下床清掃・ワックス、春季植栽エリア清掃'),
  (r3,  4,  '共用廊下床清掃、エレベーター内清掃・消毒'),
  (r3,  5,  '共用廊下床清掃・ワックス、駐車場清掃'),
  (r3,  6,  '共用廊下床清掃、梅雨対応（雨水汚れ重点清掃）'),
  (r3,  7,  '共用廊下床清掃・ワックス、ゴミ置き場清掃'),
  (r3,  8,  '共用廊下床清掃、エアコン周辺・換気口清掃'),
  (r3,  9,  '共用廊下床清掃・ワックス、外壁・バルコニー手摺清掃'),
  (r3, 10,  '共用廊下床清掃、落ち葉清掃・植栽エリア'),
  (r3, 11,  '共用廊下床清掃・ワックス、エントランスガラス清掃'),
  (r3, 12,  '共用廊下床清掃、年末大掃除（全共用部）');

-- r4: さくら総合病院
INSERT INTO public.recurring_monthly_schedules (project_id, month, work_content) VALUES
  (r4,  1,  '病棟廊下・外来待合清掃、トイレ除菌洗浄、床ワックス（一般病棟）'),
  (r4,  2,  '病棟廊下・外来待合清掃、感染対策強化（インフル対応）、除菌洗浄'),
  (r4,  3,  '病棟廊下・外来待合清掃、春季大掃除（窓・ブラインド）'),
  (r4,  4,  '病棟廊下・外来待合清掃、床ワックス（外来エリア）'),
  (r4,  5,  '病棟廊下・外来待合清掃、トイレ除菌洗浄'),
  (r4,  6,  '病棟廊下・外来待合清掃、梅雨対応（カビ防止処理）'),
  (r4,  7,  '病棟廊下・外来待合清掃、床ワックス（全エリア）、エアコン清掃'),
  (r4,  8,  '病棟廊下・外来待合清掃、トイレ除菌洗浄、消臭処理'),
  (r4,  9,  '病棟廊下・外来待合清掃、床ワックス（一般病棟）'),
  (r4, 10,  '病棟廊下・外来待合清掃、トイレ除菌洗浄'),
  (r4, 11,  '病棟廊下・外来待合清掃、感染対策強化（インフル予防）'),
  (r4, 12,  '病棟廊下・外来待合清掃、年末大掃除（全エリア徹底除菌）');

-- r5: 日本精密工業
INSERT INTO public.recurring_monthly_schedules (project_id, month, work_content) VALUES
  (r5,  1,  '工場床油汚れ除去・洗浄、機械周辺清掃'),
  (r5,  2,  '工場床油汚れ除去・洗浄、排水溝清掃'),
  (r5,  3,  '工場床洗浄、春季棚・天井付近清掃'),
  (r5,  4,  '工場床油汚れ除去・洗浄、機械周辺清掃'),
  (r5,  5,  '工場床油汚れ除去・洗浄、休憩室清掃'),
  (r5,  6,  '工場床洗浄、排水溝・雨水桝清掃'),
  (r5,  7,  '工場床油汚れ除去・洗浄、機械周辺清掃'),
  (r5,  8,  '工場床油汚れ除去・洗浄、エアコン・換気扇清掃'),
  (r5,  9,  '工場床洗浄、機械周辺清掃'),
  (r5, 10,  '工場床油汚れ除去・洗浄、排水溝清掃'),
  (r5, 11,  '工場床洗浄、機械周辺清掃'),
  (r5, 12,  '工場床油汚れ除去・洗浄、年末大掃除（全設備周辺）');

-- r6〜r10: シンプルなスケジュール
INSERT INTO public.recurring_monthly_schedules (project_id, month, work_content)
SELECT r6, m, content FROM (VALUES
  (1,'教室床清掃・ワックス、トイレ消毒'),(2,'教室床清掃・ワックス、窓ガラス清掃'),
  (3,'教室床清掃、春休み大掃除（全校）'),(4,'教室床清掃・ワックス、新学期準備清掃'),
  (5,'教室床清掃・ワックス、トイレ消毒'),(6,'教室床清掃、梅雨対策（玄関・廊下）'),
  (7,'夏休み大掃除（全校徹底清掃）'),(8,'教室床清掃・ワックス、エアコン清掃'),
  (9,'教室床清掃・ワックス、トイレ消毒'),(10,'教室床清掃・ワックス、窓ガラス清掃'),
  (11,'教室床清掃・ワックス、トイレ消毒'),(12,'冬休み大掃除（全校）、年末清掃')
) AS t(m, content);

INSERT INTO public.recurring_monthly_schedules (project_id, month, work_content)
SELECT r7, m, content FROM (VALUES
  (1,'商業施設全フロア清掃・ゴミ回収'),(2,'商業施設全フロア清掃・ゴミ回収'),
  (3,'商業施設全フロア清掃、春季ワックス（食料品フロア）'),(4,'商業施設全フロア清掃・ゴミ回収'),
  (5,'商業施設全フロア清掃・ゴミ回収'),(6,'商業施設全フロア清掃、梅雨対応（滑り止め処理）'),
  (7,'商業施設全フロア清掃・ゴミ回収'),(8,'商業施設全フロア清掃・ゴミ回収'),
  (9,'商業施設全フロア清掃・ゴミ回収'),(10,'商業施設全フロア清掃、ワックス（全フロア）'),
  (11,'商業施設全フロア清掃・ゴミ回収'),(12,'商業施設全フロア清掃、年末特別清掃（歳末セール対応）')
) AS t(m, content);

INSERT INTO public.recurring_monthly_schedules (project_id, month, work_content)
SELECT r8, m, content FROM (VALUES
  (1,'高層ビル共用部清掃・エレベーターホール磨き'),(2,'高層ビル共用部清掃・窓ガラス清掃（屋内）'),
  (3,'高層ビル共用部清掃・床ワックス（低層部）'),(4,'高層ビル共用部清掃・エレベーターホール磨き'),
  (5,'高層ビル共用部清掃・外窓清掃'),(6,'高層ビル共用部清掃・床ワックス（中層部）'),
  (7,'高層ビル共用部清掃・エレベーターホール磨き'),(8,'高層ビル共用部清掃・エアコン吹出口清掃'),
  (9,'高層ビル共用部清掃・床ワックス（高層部）'),(10,'高層ビル共用部清掃・エレベーターホール磨き'),
  (11,'高層ビル共用部清掃・窓ガラス清掃（屋内）'),(12,'高層ビル共用部清掃・年末大掃除（全フロア）')
) AS t(m, content);

INSERT INTO public.recurring_monthly_schedules (project_id, month, work_content)
SELECT r9, m, content FROM (VALUES
  (1,'ホール床洗浄・ロビー清掃'),(2,'ホール床洗浄・ロビー清掃'),
  (3,'ホール床洗浄・ロビー清掃、春季ワックス'),(4,'ホール床洗浄・ロビー清掃'),
  (5,'ホール床洗浄・ロビー清掃'),(6,'ホール床洗浄・ロビー清掃'),
  (7,'ホール床洗浄・ロビー清掃'),(8,'ホール床洗浄・ロビー清掃'),
  (9,'ホール床洗浄・ロビー清掃、秋季ワックス'),(10,'ホール床洗浄・ロビー清掃'),
  (11,'ホール床洗浄・ロビー清掃'),(12,'ホール床洗浄・ロビー清掃、年末大掃除')
) AS t(m, content);

INSERT INTO public.recurring_monthly_schedules (project_id, month, work_content)
SELECT r10, m, content FROM (VALUES
  (1,'商業施設共用部清掃・トイレ除菌'),(2,'商業施設共用部清掃・トイレ除菌'),
  (3,'商業施設共用部清掃・ワックス（1〜3F）'),(4,'商業施設共用部清掃・トイレ除菌'),
  (5,'商業施設共用部清掃・トイレ除菌'),(6,'商業施設共用部清掃・梅雨対策清掃'),
  (7,'商業施設共用部清掃・トイレ除菌'),(8,'商業施設共用部清掃・トイレ除菌'),
  (9,'商業施設共用部清掃・ワックス（全フロア）'),(10,'商業施設共用部清掃・トイレ除菌'),
  (11,'商業施設共用部清掃・トイレ除菌'),(12,'商業施設共用部清掃・年末大掃除')
) AS t(m, content);

-- ── project_billing（定期）
INSERT INTO public.project_billing (project_id, billing_status, quote_number, contract_date, billing_date, payment_due_date)
VALUES
  (r1,  'paid',              'Q-2025-R001', '2025-03-15', '2025-04-25', '2025-05-31'),
  (r2,  'paid',              'Q-2025-R002', '2024-12-20', '2025-01-25', '2025-02-28'),
  (r3,  'awaiting_payment',  'Q-2025-R003', '2024-06-10', '2025-07-25', '2025-08-31'),
  (r4,  'billed',            'Q-2025-R004', '2025-03-01', '2025-05-25', '2025-06-30'),
  (r5,  'paid',              'Q-2025-R005', '2024-12-01', '2025-01-25', '2025-02-28'),
  (r6,  'unbilled',          'Q-2025-R006', '2025-03-20', NULL,          NULL),
  (r7,  'paid',              'Q-2025-R007', '2025-05-15', '2025-06-25', '2025-07-31'),
  (r8,  'awaiting_payment',  'Q-2025-R008', '2025-02-10', '2025-03-25', '2025-04-30'),
  (r9,  'unbilled',          'Q-2025-R009', '2024-09-01', NULL,          NULL),
  (r10, 'paid',              'Q-2025-R010', '2024-03-15', '2024-04-25', '2024-05-31');

-- ── project_prices（定期：月別単価）
-- r1: 月12万円（税抜）
INSERT INTO public.project_prices (project_id, period_month, amount_ex_tax, tax_rate, tax_amount, amount_inc_tax)
SELECT r1, m, 120000, 0.10, 12000, 132000 FROM generate_series(1,12) m;

-- r2: 月8万円
INSERT INTO public.project_prices (project_id, period_month, amount_ex_tax, tax_rate, tax_amount, amount_inc_tax)
SELECT r2, m, 80000, 0.10, 8000, 88000 FROM generate_series(1,12) m;

-- r3: 月6万円
INSERT INTO public.project_prices (project_id, period_month, amount_ex_tax, tax_rate, tax_amount, amount_inc_tax)
SELECT r3, m, 60000, 0.10, 6000, 66000 FROM generate_series(1,12) m;

-- r4: 月20万円（病院は高め）
INSERT INTO public.project_prices (project_id, period_month, amount_ex_tax, tax_rate, tax_amount, amount_inc_tax)
SELECT r4, m, 200000, 0.10, 20000, 220000 FROM generate_series(1,12) m;

-- r5: 月9万円（工場は隔週）
INSERT INTO public.project_prices (project_id, period_month, amount_ex_tax, tax_rate, tax_amount, amount_inc_tax)
SELECT r5, m, 90000, 0.10, 9000, 99000 FROM generate_series(1,12) m;

-- r6: 月15万円（学校は人員多）
INSERT INTO public.project_prices (project_id, period_month, amount_ex_tax, tax_rate, tax_amount, amount_inc_tax)
SELECT r6, m, 150000, 0.10, 15000, 165000 FROM generate_series(1,12) m;

-- r7: 月50万円（毎日・商業施設）
INSERT INTO public.project_prices (project_id, period_month, amount_ex_tax, tax_rate, tax_amount, amount_inc_tax)
SELECT r7, m, 500000, 0.10, 50000, 550000 FROM generate_series(1,12) m;

-- r8: 月30万円（高層ビル）
INSERT INTO public.project_prices (project_id, period_month, amount_ex_tax, tax_rate, tax_amount, amount_inc_tax)
SELECT r8, m, 300000, 0.10, 30000, 330000 FROM generate_series(1,12) m;

-- r9: 月10万円
INSERT INTO public.project_prices (project_id, period_month, amount_ex_tax, tax_rate, tax_amount, amount_inc_tax)
SELECT r9, m, 100000, 0.10, 10000, 110000 FROM generate_series(1,12) m;

-- r10: 月7万円
INSERT INTO public.project_prices (project_id, period_month, amount_ex_tax, tax_rate, tax_amount, amount_inc_tax)
SELECT r10, m, 70000, 0.10, 7000, 77000 FROM generate_series(1,12) m;


-- ============================================================
-- 2. ホテル案件 10件
-- ============================================================

INSERT INTO public.projects (company_id, name, project_type, status, location_name, start_date, end_date, client_id, notes)
VALUES
  (cid, 'ホテルグランドパレス東京 客室清掃',     'hotel', 'active',    '東京都千代田区飯田橋1-1-1',     '2025-01-01', '2025-12-31', NULL, '全250室。チェックアウト後清掃。'),
  (cid, 'パークハイアット新宿 ハウスキーピング', 'hotel', 'active',    '東京都新宿区西新宿3-7-1-2',     '2025-04-01', '2026-03-31', NULL, '高級ホテル。高品質基準。全177室。'),
  (cid, 'ヒルトン東京お台場 客室清掃',           'hotel', 'active',    '東京都港区台場1-9-1',           '2025-01-01', '2025-12-31', NULL, '全820室。大型ホテル。'),
  (cid, '横浜ベイシェラトン 客室清掃',           'hotel', 'active',    '神奈川県横浜市西区北幸1-3-23',  '2025-06-01', '2026-05-31', NULL, '全612室。駅直結。'),
  (cid, 'ザ・プリンス さくらタワー東京 清掃',    'hotel', 'active',    '東京都港区高輪3-13-1',          '2025-03-01', '2026-02-28', NULL, '全366室。プリンスホテルグループ。'),
  (cid, 'コンラッド大阪 ハウスキーピング',       'hotel', 'active',    '大阪府大阪市北区中之島5-3-60',  '2025-07-01', '2026-06-30', NULL, '全370室。超高層ラグジュアリー。'),
  (cid, 'ウェスティンホテル大阪 客室清掃',       'hotel', 'paused',    '大阪府大阪市北区大淀中1-1-20',  '2025-01-01', '2025-12-31', NULL, '全385室。現在協議中。'),
  (cid, 'グランドハイアット福岡 清掃',           'hotel', 'active',    '福岡県福岡市博多区住吉1-2-82',  '2025-04-01', '2026-03-31', NULL, '全370室。キャナルシティ内。'),
  (cid, 'ANAクラウンプラザ神戸 ハウスキーピング','hotel', 'active',    '兵庫県神戸市中央区木之元町8-1-6','2025-02-01','2026-01-31', NULL, '全595室。神戸港望む好立地。'),
  (cid, 'リーガロイヤルホテル京都 客室清掃',     'hotel', 'completed', '京都府京都市下京区東堀川通塩小路下ル','2024-04-01','2025-03-31',NULL,'全494室。契約更新検討中。')
;

SELECT id INTO h1  FROM public.projects WHERE name = 'ホテルグランドパレス東京 客室清掃'       AND company_id = cid;
SELECT id INTO h2  FROM public.projects WHERE name = 'パークハイアット新宿 ハウスキーピング'  AND company_id = cid;
SELECT id INTO h3  FROM public.projects WHERE name = 'ヒルトン東京お台場 客室清掃'            AND company_id = cid;
SELECT id INTO h4  FROM public.projects WHERE name = '横浜ベイシェラトン 客室清掃'            AND company_id = cid;
SELECT id INTO h5  FROM public.projects WHERE name = 'ザ・プリンス さくらタワー東京 清掃'    AND company_id = cid;
SELECT id INTO h6  FROM public.projects WHERE name = 'コンラッド大阪 ハウスキーピング'        AND company_id = cid;
SELECT id INTO h7  FROM public.projects WHERE name = 'ウェスティンホテル大阪 客室清掃'        AND company_id = cid;
SELECT id INTO h8  FROM public.projects WHERE name = 'グランドハイアット福岡 清掃'            AND company_id = cid;
SELECT id INTO h9  FROM public.projects WHERE name = 'ANAクラウンプラザ神戸 ハウスキーピング' AND company_id = cid;
SELECT id INTO h10 FROM public.projects WHERE name = 'リーガロイヤルホテル京都 客室清掃'      AND company_id = cid;

-- ── hotel_project_details
INSERT INTO public.hotel_project_details
  (project_id, total_floors, operating_start_time, operating_end_time, manager_name, phone, contract_start_date, contract_end_date)
VALUES
  (h1,  20, '08:00', '18:00', '田中 一郎',   '03-3234-1111', '2025-01-01', '2025-12-31'),
  (h2,  52, '09:00', '18:00', '佐藤 誠',     '03-5322-1234', '2025-04-01', '2026-03-31'),
  (h3,  29, '07:00', '19:00', '鈴木 美穂',   '03-5500-5500', '2025-01-01', '2025-12-31'),
  (h4,  29, '08:00', '18:00', '渡辺 健二',   '045-411-1111', '2025-06-01', '2026-05-31'),
  (h5,  31, '08:00', '18:00', '伊藤 由美',   '03-3447-1111', '2025-03-01', '2026-02-28'),
  (h6,  55, '09:00', '20:00', '中村 浩二',   '06-6222-0111', '2025-07-01', '2026-06-30'),
  (h7,  35, '08:00', '18:00', '小林 義雄',   '06-6440-1111', '2025-01-01', '2025-12-31'),
  (h8,  20, '08:00', '18:00', '加藤 誠一',   '092-282-1234', '2025-04-01', '2026-03-31'),
  (h9,  36, '07:00', '19:00', '吉田 光子',   '078-291-1121', '2025-02-01', '2026-01-31'),
  (h10, 17, '08:00', '18:00', '高橋 恵美',   '075-341-2411', '2024-04-01', '2025-03-31');

-- ── hotel_floors
INSERT INTO public.hotel_floors (hotel_detail_id, floor_name, room_count, order_num) VALUES
  -- h1: グランドパレス（250室、20F）
  (h1, 'B1', 0,  0), (h1, '1F', 0,  1), (h1, '2F', 0,  2), (h1, '3F', 0,  3),
  (h1, '4F〜10F', 120, 4), (h1, '11F〜20F', 130, 5),
  -- h2: パークハイアット（177室、52F）
  (h2, '39F〜45F', 80, 0), (h2, '46F〜52F（スイート）', 97, 1),
  -- h3: ヒルトンお台場（820室、29F）
  (h3, '2F〜10F', 280, 0), (h3, '11F〜20F', 280, 1), (h3, '21F〜29F', 260, 2),
  -- h4: 横浜ベイシェラトン（612室）
  (h4, '3F〜12F', 200, 0), (h4, '13F〜22F', 200, 1), (h4, '23F〜29F', 212, 2),
  -- h5: ザプリンス（366室）
  (h5, '2F〜10F', 120, 0), (h5, '11F〜20F', 130, 1), (h5, '21F〜31F（スイート）', 116, 2),
  -- h6: コンラッド大阪（370室）
  (h6, '33F〜40F', 180, 0), (h6, '41F〜55F（スイート）', 190, 1),
  -- h7: ウェスティン大阪（385室）
  (h7, '3F〜15F', 200, 0), (h7, '16F〜35F', 185, 1),
  -- h8: グランドハイアット福岡（370室）
  (h8, '3F〜10F', 180, 0), (h8, '11F〜20F', 190, 1),
  -- h9: ANAクラウンプラザ神戸（595室）
  (h9, '3F〜15F', 300, 0), (h9, '16F〜36F', 295, 1),
  -- h10: リーガロイヤル京都（494室）
  (h10, '3F〜10F', 250, 0), (h10, '11F〜17F（スイート）', 244, 1);

-- ── hotel_staffing_rules
INSERT INTO public.hotel_staffing_rules (hotel_detail_id, time_slot, required_staff, order_num) VALUES
  (h1, '朝（8:00〜12:00）', 10, 0), (h1, '昼（12:00〜15:00）', 8, 1), (h1, '夕（15:00〜18:00）', 4, 2),
  (h2, '朝（9:00〜13:00）', 8,  0), (h2, '昼（13:00〜18:00）', 6, 1),
  (h3, '朝（7:00〜12:00）', 20, 0), (h3, '昼（12:00〜16:00）', 15, 1), (h3, '夕（16:00〜19:00）', 8, 2),
  (h4, '朝（8:00〜13:00）', 15, 0), (h4, '昼（13:00〜18:00）', 10, 1),
  (h5, '朝（8:00〜13:00）', 12, 0), (h5, '昼（13:00〜18:00）', 8, 1),
  (h6, '朝（9:00〜14:00）', 12, 0), (h6, '昼（14:00〜20:00）', 10, 1),
  (h7, '朝（8:00〜13:00）', 13, 0), (h7, '昼（13:00〜18:00）', 9, 1),
  (h8, '朝（8:00〜13:00）', 12, 0), (h8, '昼（13:00〜18:00）', 8, 1),
  (h9, '朝（7:00〜13:00）', 18, 0), (h9, '昼（13:00〜19:00）', 12, 1),
  (h10,'朝（8:00〜13:00）', 15, 0), (h10,'昼（13:00〜18:00）', 10, 1);

-- ── hotel_work_areas
INSERT INTO public.hotel_work_areas (hotel_detail_id, name, description, order_num) VALUES
  (h1, '客室清掃',   'チェックアウト後の客室全般', 0), (h1, '共用廊下', '各フロア廊下・エレベーターホール', 1), (h1, 'ロビー',     'フロント・エントランス周辺', 2), (h1, 'トイレ',     '各フロア公衆トイレ', 3),
  (h2, '客室清掃',   '高級仕様チェックリスト対応', 0), (h2, 'スイート', 'スイートルーム特別清掃', 1),         (h2, '共用エリア', 'ラウンジ・廊下', 2),
  (h3, '客室清掃',   '大量客室の効率的清掃',       0), (h3, '共用廊下', '各フロア廊下',                     1), (h3, 'ロビー',     '大型ロビー・コンシェルジュ周辺', 2), (h3, 'レストラン', 'レストラン・宴会場清掃', 3),
  (h4, '客室清掃',   'チェックアウト後清掃',       0), (h4, '共用廊下', '各フロア廊下',                     1), (h4, 'ロビー',     'フロント・エントランス', 2),
  (h5, '客室清掃',   'チェックアウト後清掃',       0), (h5, '共用廊下', '各フロア廊下',                     1), (h5, '庭園',       '日本庭園・中庭清掃',                     2),
  (h6, '客室清掃',   '超高層ラグジュアリー対応',   0), (h6, '共用廊下', '各フロア廊下',                     1), (h6, 'スカイロビー','33F スカイロビー清掃',                  2),
  (h7, '客室清掃',   'チェックアウト後清掃',       0), (h7, '共用廊下', '各フロア廊下',                     1), (h7, 'ロビー',     'フロント・エントランス', 2),
  (h8, '客室清掃',   'チェックアウト後清掃',       0), (h8, '共用廊下', '各フロア廊下',                     1), (h8, 'ロビー',     'フロント・エントランス', 2),
  (h9, '客室清掃',   'チェックアウト後清掃',       0), (h9, '共用廊下', '各フロア廊下',                     1), (h9, 'ロビー',     'フロント・エントランス', 2), (h9, '宴会場', '大宴会場・会議室清掃', 3),
  (h10,'客室清掃',   'チェックアウト後清掃',       0), (h10,'共用廊下', '各フロア廊下',                     1), (h10,'ロビー',     'フロント・エントランス', 2);

-- ── project_billing（ホテル）
INSERT INTO public.project_billing (project_id, billing_status, quote_number, contract_date, billing_date, payment_due_date, actual_payment_date)
VALUES
  (h1,  'paid',             'Q-2025-H001', '2024-12-01', '2025-01-25', '2025-02-28', '2025-02-20'),
  (h2,  'billed',           'Q-2025-H002', '2025-03-01', '2025-04-25', '2025-05-31', NULL),
  (h3,  'awaiting_payment', 'Q-2025-H003', '2024-12-01', '2025-01-25', '2025-02-28', NULL),
  (h4,  'unbilled',         'Q-2025-H004', '2025-05-15', NULL,          NULL,          NULL),
  (h5,  'paid',             'Q-2025-H005', '2025-02-01', '2025-03-25', '2025-04-30', '2025-04-25'),
  (h6,  'unbilled',         'Q-2025-H006', '2025-06-15', NULL,          NULL,          NULL),
  (h7,  'unbilled',         'Q-2025-H007', '2024-12-01', NULL,          NULL,          NULL),
  (h8,  'paid',             'Q-2025-H008', '2025-03-15', '2025-04-25', '2025-05-31', '2025-05-28'),
  (h9,  'awaiting_payment', 'Q-2025-H009', '2025-01-10', '2025-02-25', '2025-03-31', NULL),
  (h10, 'paid',             'Q-2025-H010', '2024-03-01', '2024-04-25', '2024-05-31', '2024-05-30');

-- ── project_prices（ホテル：1室単価×客室数で計算）
-- period_month = NULL（ホテル・スポットは月別管理なし）
INSERT INTO public.project_prices (project_id, period_month, amount_ex_tax, tax_rate, tax_amount, amount_inc_tax, unit_price, quantity)
VALUES
  (h1,  NULL, 2500000,  0.10, 250000,  2750000,  10000,  250),
  (h2,  NULL, 4425000,  0.10, 442500,  4867500,  25000,  177),
  (h3,  NULL, 8200000,  0.10, 820000,  9020000,  10000,  820),
  (h4,  NULL, 6120000,  0.10, 612000,  6732000,  10000,  612),
  (h5,  NULL, 4392000,  0.10, 439200,  4831200,  12000,  366),
  (h6,  NULL, 9250000,  0.10, 925000, 10175000,  25000,  370),
  (h7,  NULL, 3850000,  0.10, 385000,  4235000,  10000,  385),  -- on_hold → paused対応済み
  (h8,  NULL, 4440000,  0.10, 444000,  4884000,  12000,  370),
  (h9,  NULL, 5950000,  0.10, 595000,  6545000,  10000,  595),
  (h10, NULL, 5928000,  0.10, 592800,  6520800,  12000,  494);

END $$;
