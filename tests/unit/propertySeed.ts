import fc from 'fast-check'

// CI runs every property with one fixed seed, so a red run fails the same way again; FC_SEED
// replays the seed a failure printed. Local runs draw a fresh seed each time to explore more.
const CI_SEED = 20261118

const seed = process.env.FC_SEED ? Number(process.env.FC_SEED) : process.env.CI ? CI_SEED : null
if (seed !== null) fc.configureGlobal({ seed })
