// `npm run migrate` — create tables and seed content without starting the server.
const { migrate, pool } = require('./db');

migrate()
  .then(() => { console.log('🌸 database is ready'); return pool.end(); })
  .catch(err => { console.error(err); process.exit(1); });
