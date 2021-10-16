const fs = require("fs")

const Koa = require("koa")
const app = new Koa()
app.proxy = true

const auth = require("basic-auth")

const templatedir = __dirname + "/../templates"
const staticdir = __dirname + "/../static"
const datadir = __dirname + "/../data"

app.use(require("koa-static")(staticdir, { maxage: 86400000 /*1 day*/ }))
app.use(require("multy")({}))

const Handlebars = require("handlebars")

const dayjs = require("dayjs")
require("dayjs/locale/de")
dayjs.locale("de")

interface Project {
  name: string
  code: string
  category: string
  link: string
  description: string
}

interface Options {
  categories: string[]
  projects: Project[]
}

const options: Options = JSON.parse(fs.readFileSync(datadir + "/options.json"))
const codes = options.projects.map((p) => p.code)

const VOTING_NAME = process.env["VOTING_NAME"]
const VOTING_NAME_CAPITALIZED = VOTING_NAME
  ? VOTING_NAME[0].toUpperCase() + VOTING_NAME.substr(1)
  : ""

const db = require("./database")

db.connect()
  .then(() => db.initialize(codes))
  .then(() => {
    app.listen(8083)
    console.log("listening on :8083")
  })

Handlebars.registerHelper("ifeq", function (a, b, opt) {
  if (a == b) {
    return opt.fn(this)
  }
  return opt.inverse(this)
})

Handlebars.registerHelper("newlinetobr", function (opt) {
  return opt.fn(this).replaceAll("\n", "<br><br>")
})

interface User {
  name: string
  pass: string
  admin?: boolean
}

let users: User[] = JSON.parse(fs.readFileSync(datadir + "/users.json"))

function basicAuth(ctx) {
  let login = auth(ctx)

  if (!login || !login.name || !login.pass) {
    ctx.throw(401, null, {
      headers: {
        "WWW-Authenticate": `Basic realm="vote-${VOTING_NAME}"`,
      },
    })
    return { loginStatus: false }
  }

  let user = users.find(
    (user) => user.name == login.name && user.pass == login.pass
  )

  if (!user) {
    ctx.throw(401, null, {
      headers: {
        "WWW-Authenticate": `Basic realm="vote-${VOTING_NAME}"`,
      },
    })
    return { loginStatus: false }
  }

  return {
    username: login.name,
    isAdmin: user.admin || false,
    loginStatus: true,
  }
}

async function checkVotedAlready(ctx, username: string) {
  if (await db.hasVoted(username)) {
    console.log(`${new Date().toISOString()}: error: already voted`)
    ctx.throw(401, "Bereits abgestimmt", { tryagain: false })
    return false
  }
  return true
}

app.use(async (ctx, next) => {
  try {
    await next()
  } catch (err) {
    if (err.status == 401) {
      throw err
    }
    const data = {
      votingname: VOTING_NAME_CAPITALIZED,
      message: err.message,
      tryagain: err.tryagain,
    }
    // to only throw non-http errors
    if (!err.status) {
      console.log(err)
    }
    ctx.body = await Handlebars.compile(
      fs.readFileSync(templatedir + "/error.html").toString()
    )(data)
  }
})

const DATE_MIN = process.env["DATE_MIN"]
const DATE_MAX = process.env["DATE_MAX"]
const DATE_FORMAT = "D. MMM. YYYY"

function outOfDateRange() {
  let currentDate = new Date().toISOString().substr(0, 10)
  if (!DATE_MIN || currentDate >= DATE_MIN) {
    if (!DATE_MAX || currentDate <= DATE_MAX) {
      return false
    } else {
      return 1 //past DATE_MAX
    }
  } else {
    return -1 //before DATE_MIN
  }
  return true
}

function checkDateRange(ctx) {
  let rangeinfo = outOfDateRange()
  if (rangeinfo === 1) {
    //to not confuse with true
    ctx.throw(403, `Abstimmung wieder geschlossen`, { tryagain: false })
    return false
  }
  if (rangeinfo == -1) {
    ctx.throw(
      403,
      `Abstimmung noch geschlossen.<br>Sie öffnet am ${dayjs(DATE_MIN).format(
        DATE_FORMAT
      )}.`,
      { tryagain: false }
    )
    return false
  }
  return true
}

app.use(async (ctx) => {
  if (ctx.url == "/vote") {
    if (!checkDateRange(ctx)) return

    let { username, loginStatus } = basicAuth(ctx)
    if (!loginStatus) return
    if (!(await checkVotedAlready(ctx, username))) return

    let shuffledProjects = [...options.projects].sort(() => Math.random() - 0.5)

    let data = {
      datemax: DATE_MAX ? dayjs(DATE_MAX).format(DATE_FORMAT) : undefined,
      votingname: VOTING_NAME_CAPITALIZED,
      projects: shuffledProjects,
    }
    ctx.body = await Handlebars.compile(
      fs.readFileSync(templatedir + "/vote.html").toString()
    )(data)
  } else if (ctx.url == "/submit") {
    if (!checkDateRange(ctx)) return

    let { username, loginStatus } = basicAuth(ctx)
    if (!loginStatus) return
    if (!(await checkVotedAlready(ctx, username))) return

    const formdata = ctx.request.body
    if (formdata && Object.keys(formdata).length != 0) {
      if (!formdata["consent"] || formdata["consent"] != "on") {
        console.log(`${new Date().toISOString()}: error: consent not given`)
        ctx.throw(406, "Zustimmung nicht gegeben", { tryagain: true })
        return
      }

      let votes: { [key: string]: number } = {}
      Object.keys(formdata).forEach((fieldkey) => {
        if (fieldkey != "consent") {
          let value = parseInt(formdata[fieldkey])
          if (!value) {
            ctx.throw(400, `Fehlender Wert bei key ${fieldkey}`, {
              tryagain: true,
            })
            return
          }
          if (value < 1 || value > codes.length) {
            ctx.throw(400, `Ungültiger Wert bei key ${fieldkey}: ${value}`, {
              tryagain: true,
            })
            return
          }
          votes[fieldkey] = value
        }
      })

      let amount = Object.keys(votes).length
      if (amount == 0) {
        console.log(`${new Date().toISOString()}: error: no options selected`)
        ctx.throw(400, "Gar keine Optionen ausgewählt", { tryagain: true })
        return
      }
      if (amount != codes.length) {
        console.log(
          `${new Date().toISOString()}: error: wrong amount of rankings`
        )
        ctx.throw(
          400,
          `Falsche Anzahl von Ranks: ${amount} statt ${codes.length} erlaubte`,
          { tryagain: true }
        )
        return
      }

      for (let code of codes) {
        if (!(code in votes)) {
          console.log(`${new Date().toISOString()}: error: missing ${code}`)
          ctx.throw(400, `Fehlendes Projekt: ${code}`, { tryagain: true })
          return
        }
      }

      let success = await db.castVotes(votes, username)

      if (!success) {
        console.log(`${new Date().toISOString()}: error: failed to cast vote`)
        ctx.throw(
          500,
          "Interner Fehler beim Speichern der Stimmen,<br>kontaktiere bitte den Seitenbetreiber.",
          { tryagain: true }
        )
        return
      }

      console.log(`${new Date().toISOString()}: successful vote submission`)

      ctx.status = 303
      ctx.redirect("/results")
    } else {
      console.log(`${new Date().toISOString()}: error: no form data`)
      ctx.throw(400, "Keine Formulardaten"), { tryagain: true }
    }
  } else if (ctx.url == "/results") {
    let { isAdmin, loginStatus } = basicAuth(ctx)
    if (!loginStatus) return

    let [nvoters, votes] = await Promise.all([
      db.getAmountOfVoters(),
      db.getVotes(),
    ])

    let data = {
      votingname: VOTING_NAME_CAPITALIZED,
      canvote: !outOfDateRange(),
      votingover: outOfDateRange() === 1,
      datemin: DATE_MIN ? dayjs(DATE_MIN).format(DATE_FORMAT) : undefined,
      datemax: DATE_MAX ? dayjs(DATE_MAX).format(DATE_FORMAT) : undefined,
      nvoters,
      votes,
      options,
      isAdmin,
    }
    ctx.body = await Handlebars.compile(
      fs.readFileSync(templatedir + "/results.html").toString()
    )(data)
  } else if (ctx.url == "/") {
    ctx.status = 303
    ctx.redirect("/results")
  } else {
    ctx.throw(404, "404 Not found")
  }
})
