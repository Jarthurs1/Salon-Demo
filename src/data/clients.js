/**
 * Local-mode seed clients. Prefer demoSeed for realistic fictional data.
 * AWS seeding is deliberate via `npm run seed:demo -- --upload --force`.
 */

import { DEMO_CLIENTS } from './demoSeed.js'

export const SEED_CLIENTS = DEMO_CLIENTS.map((client) => ({
  ...client,
  displayName: `${client.firstName} ${client.lastName}`,
  name: `${client.firstName} ${client.lastName}`,
}))
