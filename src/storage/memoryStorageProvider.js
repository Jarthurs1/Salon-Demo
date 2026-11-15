/**
 * In-memory storage provider for unit tests.
 */
export function createMemoryStorageProvider(initial = {}) {
  const store = new Map(
    Object.entries(initial).map(([key, value]) => [key, structuredClone(value)]),
  )

  return {
    name: 'memory',
    async readJson(key) {
      if (!store.has(key)) return null
      return structuredClone(store.get(key))
    },
    async writeJson(key, data) {
      store.set(key, structuredClone(data))
      return structuredClone(data)
    },
    async exists(key) {
      return store.has(key)
    },
    __dump() {
      return Object.fromEntries(store.entries())
    },
  }
}
