import { Pool } from "https://deno.land/x/postgres@v0.4.5/mod.ts";
import { PoolClient } from "https://deno.land/x/postgres@v0.4.5/client.ts";

function fail(msg: string, kill: boolean = true) {
  return async (error) => {
    console.error(msg)
    console.error(error)
    if(kill) {
      await close().catch(() => {})
      Deno.exit(1)
    }
    return false
  }
}

var dbPool
export async function connect() {
  dbPool = new Pool({
    user: "postgres",
    password: Deno.env.get("DB_PASSWORD"),
    database: "abiball",
    hostname: Deno.env.get("DB_HOST"),
    port: parseInt(Deno.env.get("DB_PORT"))
  }, 5)
}

export async function initialize() {
  const client: PoolClient = await dbPool.connect()
    .catch(fail("cannot connect to database"))
  const result1 = await client.query("CREATE TABLE IF NOT EXISTS votes (" +
    "id serial PRIMARY KEY," +
    "name varchar," +
    "votes integer DEFAULT 0);")
    .catch(fail("cannot create votes table"))
  const result2 = await client.query("CREATE TABLE IF NOT EXISTS voters (" +
    "iphash varchar, votetime timestamp);")
    .catch(fail("cannot create voters table"))
  client.release()
}

export async function getVotes() {
  const client: PoolClient = await dbPool.connect()
    .catch(fail("cannot connect to database"))
  const result = await client.query("SELECT * FROM votes ORDER BY name ASC;")
    .catch(fail("cannot select votes"))
  if (!result) return null
  let res = result.rowsOfObjects()
  client.release()
  return res
}

export async function getSortedVotes() {
  const client: PoolClient = await dbPool.connect().catch(fail("cannot connect to database"))
  const result = await client.query("SELECT * FROM votes ORDER BY votes DESC, name ASC;")
    .catch(fail("cannot select votes (sorted)"))
  if (!result) return null
  let res = result.rowsOfObjects()
  client.release()
  return res
}

export async function castVotes(ids: string[]): boolean {
  let safeids = ids.map(id => parseInt(id)).join(",")
  const client: PoolClient = await dbPool.connect().catch(fail("cannot connect to database"))
  const result = await client.query(`UPDATE votes SET votes = votes + 1 WHERE id IN (${ids});`)
    .then(() => true, fail("cannot register votes", false))
  client.release()
  return result
}

export async function hasVoted(hash: string): boolean {
  const client: PoolClient = await dbPool.connect().catch(fail("cannot connect to database"))
  const result = await client.query(`SELECT iphash FROM voters WHERE iphash = '${hash}';`)
    .catch(fail("cannot check if hash has voted", false))
  let res = result.rowCount > 0
  client.release()
  return res
}

export async function noteVoted(hash: string) {
  const client: PoolClient = await dbPool.connect().catch(fail("cannot connect to database"))
  const result = await client.query(`INSERT INTO voters (iphash, votetime) VALUES ('${hash}', current_timestamp);`)
    .catch(fail("cannot note that hash has voted", false))
  client.release()
}

export async function close() {
  return dbPool.end()
}
