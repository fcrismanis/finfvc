-- =============================================================
-- FINANCE — Seed: Global Macro Categories & Categories
-- Migration: 0002_seed_categories.sql
-- family_id = NULL → shared across all families
-- =============================================================

insert into macro_categories
  (id, family_id, name, classification_type, display_in_result, display_in_cashflow, display_in_budget, color, icon, sort_order)
values
  ('mac_receita_op',  null, 'Receitas Operacionais',  'operational_income',  true,  true,  true,  '#16A34A', 'trending-up',   1),
  ('mac_receita_ev',  null, 'Receitas Eventuais',     'extraordinary_income',true,  true,  false, '#65A30D', 'coins',         2),
  ('mac_alimentacao', null, 'Alimentação',            'operational_expense', true,  true,  true,  '#F97316', 'utensils',      3),
  ('mac_casa',        null, 'Casa',                   'operational_expense', true,  true,  true,  '#6366F1', 'home',          4),
  ('mac_saude',       null, 'Saúde',                  'operational_expense', true,  true,  true,  '#10B981', 'heart-pulse',   5),
  ('mac_transporte',  null, 'Transporte',             'operational_expense', true,  true,  true,  '#0EA5E9', 'car',           6),
  ('mac_educacao',    null, 'Educação',               'operational_expense', true,  true,  true,  '#8B5CF6', 'book-open',     7),
  ('mac_assinaturas', null, 'Assinaturas',            'operational_expense', true,  true,  true,  '#F59E0B', 'repeat',        8),
  ('mac_compras',     null, 'Compras',                'operational_expense', true,  true,  true,  '#F43F5E', 'shopping-bag',  9),
  ('mac_servicos',    null, 'Serviços',               'operational_expense', true,  true,  true,  '#64748B', 'wrench',       10),
  ('mac_seguros',     null, 'Seguros',                'operational_expense', true,  true,  true,  '#0891B2', 'shield',       11),
  ('mac_lazer',       null, 'Lazer',                  'operational_expense', true,  true,  true,  '#EC4899', 'ticket',       12),
  ('mac_pets',        null, 'Pets',                   'operational_expense', true,  true,  true,  '#A16207', 'paw-print',    13),
  ('mac_presentes',   null, 'Presentes',              'operational_expense', true,  true,  true,  '#DB2777', 'gift',         14),
  ('mac_doacoes',     null, 'Doações',                'operational_expense', true,  true,  true,  '#DC2626', 'hand-heart',   15),
  ('mac_prestadores', null, 'Prestadores',            'operational_expense', true,  true,  true,  '#7C3AED', 'users',        16),
  ('mac_impostos',    null, 'Impostos e Taxas',       'operational_expense', true,  true,  true,  '#B45309', 'receipt',      17),
  ('mac_cuidados',    null, 'Cuidados Pessoais',      'operational_expense', true,  true,  true,  '#0D9488', 'sparkles',     18),
  ('mac_divida',      null, 'Dívida',                 'debt_cost',           true,  true,  true,  '#991B1B', 'alert-triangle',19),
  ('mac_movfin',      null, 'Movimentação Financeira','neutral',             false, true,  false, '#9CA3AF', 'refresh-cw',   20)
on conflict (id) do nothing;

insert into categories
  (id, family_id, name, macro_category_id, classification_type,
   default_include_in_operational_result, default_include_in_cashflow,
   default_include_in_budget, is_internal_transfer_default, sort_order)
values
  ('cat_salario',          null, 'Salário',                    'mac_receita_op',  'operational_income',  true,  true,  true,  false, 1),
  ('cat_fit',              null, 'Pagamento FIT',              'mac_receita_op',  'operational_income',  true,  true,  true,  false, 2),
  ('cat_outras_receitas',  null, 'Outras Receitas',            'mac_receita_ev',  'extraordinary_income',true,  true,  false, false, 1),
  ('cat_alimentacao',      null, 'Alimentação',                'mac_alimentacao', 'operational_expense', true,  true,  true,  false, 1),
  ('cat_restaurantes',     null, 'Restaurantes',               'mac_alimentacao', 'operational_expense', true,  true,  true,  false, 2),
  ('cat_padaria',          null, 'Padaria / Delivery',         'mac_alimentacao', 'operational_expense', true,  true,  true,  false, 3),
  ('cat_acougue',          null, 'Açougue',                    'mac_alimentacao', 'operational_expense', true,  true,  true,  false, 4),
  ('cat_suplementos',      null, 'Suplementos',                'mac_alimentacao', 'operational_expense', true,  true,  true,  false, 5),
  ('cat_prestacao',        null, 'Prestação',                  'mac_casa',        'operational_expense', true,  true,  true,  false, 1),
  ('cat_contas',           null, 'Contas de Consumo',          'mac_casa',        'operational_expense', true,  true,  true,  false, 2),
  ('cat_iptu',             null, 'IPTU',                       'mac_casa',        'operational_expense', true,  true,  true,  false, 3),
  ('cat_manutencao_casa',  null, 'Manutenção',                 'mac_casa',        'operational_expense', true,  true,  true,  false, 4),
  ('cat_academias',        null, 'Academias',                  'mac_saude',       'operational_expense', true,  true,  true,  false, 1),
  ('cat_farmacia',         null, 'Farmácia',                   'mac_saude',       'operational_expense', true,  true,  true,  false, 2),
  ('cat_combustivel',      null, 'Combustível',                'mac_transporte',  'operational_expense', true,  true,  true,  false, 1),
  ('cat_estacionamento',   null, 'Estacionamento / Sem Parar', 'mac_transporte',  'operational_expense', true,  true,  true,  false, 2),
  ('cat_bethel',           null, 'Bethel',                     'mac_educacao',    'operational_expense', true,  true,  true,  false, 1),
  ('cat_idiomas',          null, 'Idiomas',                    'mac_educacao',    'operational_expense', true,  true,  true,  false, 2),
  ('cat_supera',           null, 'Supera',                     'mac_educacao',    'operational_expense', true,  true,  true,  false, 3),
  ('cat_ia',               null, 'IA / Produtividade',         'mac_assinaturas', 'operational_expense', true,  true,  true,  false, 1),
  ('cat_spotify',          null, 'Spotify',                    'mac_assinaturas', 'operational_expense', true,  true,  true,  false, 2),
  ('cat_compras',          null, 'Compras',                    'mac_compras',     'operational_expense', true,  true,  true,  false, 1),
  ('cat_ml',               null, 'Mercado Livre / Amazon',     'mac_compras',     'operational_expense', true,  true,  true,  false, 2),
  ('cat_dividas',          null, 'Dívidas',                    'mac_divida',      'debt_cost',           true,  true,  true,  false, 1),
  ('cat_resgate',          null, 'Resgate',                    'mac_movfin',      'redemption',          false, true,  false, false, 1),
  ('cat_aporte',           null, 'Aporte',                     'mac_movfin',      'investment',          false, true,  false, false, 2)
on conflict (id) do nothing;

-- Classification rules (global keyword → category mapping)
insert into classification_rules
  (keyword, match_type, category_id, macro_category_id, classification_type, priority)
values
  ('salario',           'contains', 'cat_salario',         'mac_receita_op',  'operational_income',  90),
  ('pagto fit',         'contains', 'cat_fit',             'mac_receita_op',  'operational_income',  90),
  ('resgate',           'contains', 'cat_resgate',         'mac_movfin',      'redemption',          80),
  ('aporte',            'contains', 'cat_aporte',          'mac_movfin',      'investment',          80),
  ('bethel',            'contains', 'cat_bethel',          'mac_educacao',    'operational_expense', 80),
  ('supera',            'contains', 'cat_supera',          'mac_educacao',    'operational_expense', 80),
  ('spotify',           'contains', 'cat_spotify',         'mac_assinaturas', 'operational_expense', 80),
  ('juros limite',      'contains', 'cat_dividas',         'mac_divida',      'debt_cost',           90),
  ('farmacia',          'contains', 'cat_farmacia',        'mac_saude',       'operational_expense', 70),
  ('combustivel',       'contains', 'cat_combustivel',     'mac_transporte',  'operational_expense', 70),
  ('mercado livre',     'contains', 'cat_ml',              'mac_compras',     'operational_expense', 70),
  ('amazon',            'contains', 'cat_ml',              'mac_compras',     'operational_expense', 70),
  ('sem parar',         'contains', 'cat_estacionamento',  'mac_transporte',  'operational_expense', 70),
  ('estacionamento',    'contains', 'cat_estacionamento',  'mac_transporte',  'operational_expense', 70)
on conflict do nothing;
