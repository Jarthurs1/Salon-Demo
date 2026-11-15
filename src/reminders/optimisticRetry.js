/**
 * Bounded optimistic concurrency: reload → reapply → conditional write.
 */

export async function withOptimisticRetry({
  load,
  apply,
  save,
  maxAttempts = 3,
}) {
  let lastError = null
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const loaded = await load()
    const next = await apply(loaded)
    try {
      await save(next, loaded)
      return { ok: true, value: next, attempts: attempt }
    } catch (error) {
      lastError = error
      const conflict =
        error?.name === 'PreconditionFailed' ||
        error?.Code === 'PreconditionFailed' ||
        error?.$metadata?.httpStatusCode === 412 ||
        error?.status === 412 ||
        error?.code === 'conflict'
      if (!conflict || attempt === maxAttempts) {
        throw error
      }
    }
  }
  throw lastError
}
