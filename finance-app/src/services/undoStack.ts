type UndoEntry = {
  label: string
  undo: () => Promise<void> | void
}

const stack: UndoEntry[] = []
const MAX_ENTRIES = 30
const listeners = new Set<() => void>()

function notify() {
  for (const l of listeners) l()
}

export function pushUndo(entry: UndoEntry): void {
  stack.push(entry)
  if (stack.length > MAX_ENTRIES) stack.shift()
  notify()
}

export async function popAndRunUndo(): Promise<string | null> {
  const entry = stack.pop()
  if (!entry) return null
  notify()
  await entry.undo()
  return entry.label
}

export function canUndo(): boolean {
  return stack.length > 0
}

export function subscribeUndoStack(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
