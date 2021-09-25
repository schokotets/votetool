const pg = require("pg")

function fail(msg: string, kill: boolean = true) {
  return async (error) => {
    console.error(msg)
    console.error(error)
    if(kill) {
      await close().catch(() => {})
      process.exit(1)
    }
    return false
  }
}

var dbPool
export async function connect() {
  console.log("connecting to database...")
  dbPool = new pg.Pool({
    user: process.env["DB_USER"],
    password: process.env["DB_PASSWORD"],
    database: process.env["DB_NAME"],
    host: process.env["DB_HOST"],
    port: parseInt(process.env["DB_PORT"])
  }, 5)
}

const TABLE_PREFIX = process.env["VOTING_NAME"] ? `${process.env["VOTING_NAME"]}_` : ""

export async function initialize() {
  console.log("initializing database with tables...")
  const client = await dbPool.connect()
    .catch(fail("cannot connect to database"))
  const result1 = await client.query(`CREATE TABLE IF NOT EXISTS ${TABLE_PREFIX}votes (` +
    "id serial PRIMARY KEY," +
    "name varchar," +
    "votes integer DEFAULT 0);")
    .catch(fail(`cannot create ${TABLE_PREFIX}votes table`))
  const result2 = await client.query(`CREATE TABLE IF NOT EXISTS ${TABLE_PREFIX}voters (` +
    "iphash varchar, votetime timestamp);")
    .catch(fail(`cannot create ${TABLE_PREFIX}voters table`))
  client.release()
}

export async function getAmountOfVoters() {
  const client = await dbPool.connect()
    .catch(fail("cannot connect to database"))
  const result = await client.query(`SELECT COUNT(*) FROM ${TABLE_PREFIX}voters;`)
    .catch(fail("cannot select votes"))
  if (!result) return null
  let res = result.rows[0].count
  client.release()
  return res
}

export async function getVotes() {
  const client = await dbPool.connect()
    .catch(fail("cannot connect to database"))
  const result = await client.query(`SELECT * FROM ${TABLE_PREFIX}votes ORDER BY name ASC;`)
    .catch(fail("cannot select votes"))
  if (!result) return null
  let res = result.rows
  client.release()
  return res
}

export async function getSortedVotes() {
  const client = await dbPool.connect().catch(fail("cannot connect to database"))
  const result = await client.query(`SELECT * FROM ${TABLE_PREFIX}votes ORDER BY votes DESC, name ASC;`)
    .catch(fail("cannot select votes (sorted)"))
  if (!result) return null
  let res = result.rows
  client.release()
  return res
}

export async function castVotes(ids: string[]): Promise<boolean> {
  let safeids = ids.map(id => parseInt(id)).join(",")
  const client = await dbPool.connect().catch(fail("cannot connect to database"))
  const result = await client.query(`UPDATE ${TABLE_PREFIX}votes SET votes = votes + 1 WHERE id IN (${ids});`)
    .then(() => true, fail("cannot register votes", false))
  client.release()
  return result
}

export async function hasVoted(hash: string): Promise<boolean> {
  const client = await dbPool.connect().catch(fail("cannot connect to database"))
  const result = await client.query(`SELECT iphash FROM ${TABLE_PREFIX}voters WHERE iphash = '${hash}';`)
    .catch(fail("cannot check if hash has voted", false))
  let res = result.rowCount > 0
  client.release()
  return res
}

export async function noteVoted(hash: string) {
  const client = await dbPool.connect().catch(fail("cannot connect to database"))
  const result = await client.query(`INSERT INTO ${TABLE_PREFIX}voters (iphash, votetime) VALUES ('${hash}', current_timestamp);`)
    .catch(fail("cannot note that hash has voted", false))
  client.release()
}

export async function close() {
  return dbPool.end()
}
