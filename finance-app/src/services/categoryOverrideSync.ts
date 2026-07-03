// Sync de overrides de categorias/macros: Supabase é fonte de verdade,
// localStorage é cache síncrono. Os serviços financeCategories e
// financeParentCategories continuam lendo localStorage de forma síncrona
// (getAllCategories / getAllMacroCategories são chamados no engine inteiro);
// este módulo popula esse cache no login e reflete cada save para o Supabase.
import { supabase } from '../lib/supabase'
import type { Category, MacroCategory } from '../types'

export const MACRO_STORAGE_KEY = 'finance_parent_categories_custom'
export const CATEGORY_STORAGE_KEY = 'finance_categories_custom'

type OverrideKind = 'macro' | 'category'

let _familyId: string | null = null
export function setCategoryOverrideFamily(fid: string | null) { _familyId = fid }

interface OverrideRow { kind: OverrideKind; entity_id: string; data: unknown }

/** Sobrescreve o cache local com o DB, ou semeia local→DB se o DB estiver vazio. */
function reconcileKind(kind: OverrideKind, storageKey: string, fromDb: Array<Category | MacroCategory>): void {
  if (fromDb.length > 0) {
    localStorage.setItem(storageKey, JSON.stringify(fromDb))
    return
  }
  let local: Array<Category | MacroCategory> = []
  try { local = JSON.parse(localStorage.getItem(storageKey) ?? '[]') } catch { local = [] }
  if (local.length > 0) {
    pushCategoryOverrides(kind, local)   // sobe o cache existente; mantém localStorage
  } else {
    localStorage.setItem(storageKey, '[]')
  }
}

/**
 * Busca overrides no Supabase e popula o cache localStorage. Só sobrescreve
 * o cache quando a consulta responde — falha de rede mantém o cache atual.
 */
export async function syncCategoryOverridesFromSupabase(familyId: string): Promise<void> {
  setCategoryOverrideFamily(familyId)
  try {
    const { data, error } = await supabase
      .from('fin_category_overrides')
      .select('kind,entity_id,data')
      .eq('family_id', familyId)
    if (error || !data) return

    const macros: MacroCategory[] = []
    const categories: Category[] = []
    for (const row of data as OverrideRow[]) {
      if (row.kind === 'macro') macros.push(row.data as MacroCategory)
      else if (row.kind === 'category') categories.push(row.data as Category)
    }
    // Reconcilia por kind. Se o DB ainda não tem linhas daquele kind mas o
    // cache local tem (primeiro login pós-deploy), semeia local→DB em vez de
    // apagar o cache. Caso contrário, o DB é a verdade e sobrescreve o cache.
    reconcileKind('macro', MACRO_STORAGE_KEY, macros)
    reconcileKind('category', CATEGORY_STORAGE_KEY, categories)
  } catch {
    /* offline / tabela inacessível — mantém cache local */
  }
}

/**
 * Reflete o estado completo de um tipo (macro|category) para o Supabase por
 * full-replace: apaga as linhas daquele family+kind e reinsere o array atual.
 * Mantém o DB idêntico ao localStorage, sem linhas órfãs em deletes.
 * Fire-and-forget: nunca bloqueia a UI.
 */
export function pushCategoryOverrides(kind: OverrideKind, items: Array<Category | MacroCategory>): void {
  const familyId = _familyId
  if (!familyId) return
  void (async () => {
    try {
      await supabase
        .from('fin_category_overrides')
        .delete()
        .eq('family_id', familyId)
        .eq('kind', kind)
      if (items.length === 0) return
      const rows = items.map(item => ({
        family_id: familyId,
        kind,
        entity_id: item.id,
        data: item,
        updated_at: new Date().toISOString(),
      }))
      await supabase.from('fin_category_overrides').insert(rows)
    } catch {
      /* não bloqueia UI; próximo save reconcilia */
    }
  })()
}
