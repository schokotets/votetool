const pg = require("pg")

function fail(msg: string, kill: boolean = true) {
  return async (error) => {
    console.error(msg)
    console.error(error)
    if (kill) {
      await close().catch(() => {})
      process.exit(1)
    }
    return false
  }
}

var dbPool
export async function connect() {
  console.log("connecting to database...")
  dbPool = new pg.Pool(
    {
      user: process.env["DB_USER"],
      password: process.env["DB_PASSWORD"],
      database: process.env["DB_NAME"],
      host: process.env["DB_HOST"],
      port: parseInt(process.env["DB_PORT"]),
    },
    5
  )
}

const TABLE_PREFIX = process.env["VOTING_NAME"]
  ? `${process.env["VOTING_NAME"]}_`
  : ""

export async function initialize(codes: string[]) {
  console.log("initializing database with tables...")
  const client = await dbPool
    .connect()
    .catch(fail("cannot connect to database", true))
  const result1 = await client
    .query(
      `CREATE TABLE IF NOT EXISTS ${TABLE_PREFIX}votes (` +
        "name varchar PRIMARY KEY," +
        codes.map((code) => `${code} integer,`).join("") +
        "votetime timestamp);"
    )
    .catch(fail(`cannot create ${TABLE_PREFIX}votes table`))
}

export async function getAmountOfVoters() {
  const client = await dbPool
    .connect()
    .catch(fail("cannot connect to database"))
  const result = await client
    .query(`SELECT COUNT(*) FROM ${TABLE_PREFIX}votes;`)
    .catch(fail("cannot select votes"))
  if (!result) return null
  let res = result.rows[0].count
  client.release()
  return res
}

export async function getVotes() {
  const client = await dbPool
    .connect()
    .catch(fail("cannot connect to database"))
  const result = await client
    .query(`SELECT * FROM ${TABLE_PREFIX}votes;`)
    .catch(fail("cannot select votes"))
  if (!result) return null
  let res = result.rows
  client.release()
  return res
}

export async function castVotes(
  votes: { [key: string]: number },
  username: string
): Promise<boolean> {
  const client = await dbPool
    .connect()
    .catch(fail("cannot connect to database"))
  const result = await client
    .query(
      `INSERT INTO ${TABLE_PREFIX}votes` +
        "(name, votetime," +
        Object.keys(votes).join(",") +
        `) VALUES ('${username}', now(), ` +
        Object.values(votes).join(",") +
        ");"
    )
    .then(() => true, fail("cannot register votes", false))
  client.release()
  return result
}

export async function hasVoted(username: string): Promise<boolean> {
  const client = await dbPool
    .connect()
    .catch(fail("cannot connect to database"))
  const result = await client
    .query(`SELECT name FROM ${TABLE_PREFIX}votes WHERE name = '${username}';`)
    .catch(fail("cannot check if hash has voted", false))
  let res = result.rowCount > 0
  client.release()
  return res
}

export async function close() {
  return dbPool.end()
}
