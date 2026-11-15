import { getClientById, updateClient } from '../services/clientRepository.js'

export const DEMO_SAVED_CARD = { brand: 'Visa', last4: '4242' }

export async function saveDemoCard(clientId) {
  const client = getClientById(clientId)
  if (!client) return { ok: false, message: 'Choose a customer.' }
  if (client.savedCard) return { ok: true, already: true }
  await updateClient(clientId, { savedCard: { ...DEMO_SAVED_CARD } })
  return { ok: true, already: false }
}
