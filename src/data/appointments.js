/**
 * Local-mode seed appointments (dynamic dates).
 * AWS seeding is deliberate via `npm run seed:demo -- --upload --force`.
 */

export { buildDemoAppointments as buildSeedAppointments } from './demoSeed.js'
