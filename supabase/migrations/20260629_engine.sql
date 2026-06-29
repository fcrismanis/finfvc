-- Engine Financeira — Phase 2
-- Roda em: Supabase Dashboard > SQL Editor

-- Configuração centralizada (classificação, categoria, subcategoria)
CREATE TABLE IF NOT EXISTS fin_engine_config (
  family_id  UUID   NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  scope      TEXT   NOT NULL CHECK (scope IN ('classification','category','subcategory','global')),
  scope_id   TEXT   NOT NULL,
  config     JSONB  NOT NULL DEFAULT '{}',
  note       TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by TEXT,
  PRIMARY KEY (family_id, scope, scope_id)
);

-- Auditoria de alterações
CREATE TABLE IF NOT EXISTS fin_engine_audit (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id  UUID        NOT NULL,
  scope      TEXT        NOT NULL,
  scope_id   TEXT        NOT NULL,
  scope_name TEXT,
  flag       TEXT,
  old_value  JSONB,
  new_value  JSONB,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  changed_by TEXT,
  note       TEXT,
  origin     TEXT        NOT NULL DEFAULT 'ui'
);

-- RLS
ALTER TABLE fin_engine_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE fin_engine_audit  ENABLE ROW LEVEL SECURITY;

CREATE POLICY engine_config_family ON fin_engine_config
  USING (family_id IN (SELECT family_id FROM family_members WHERE user_id = auth.uid()));
CREATE POLICY engine_audit_family ON fin_engine_audit
  USING (family_id IN (SELECT family_id FROM family_members WHERE user_id = auth.uid()));

-- Índices
CREATE INDEX IF NOT EXISTS idx_engine_config_family ON fin_engine_config(family_id);
CREATE INDEX IF NOT EXISTS idx_engine_audit_family_date ON fin_engine_audit(family_id, changed_at DESC);
