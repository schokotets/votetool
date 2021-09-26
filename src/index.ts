const fs = require("fs")
const crypt = require("crypto")

const Koa = require("koa")
const app = new Koa()
app.proxy = true

const templatedir = __dirname + "/../templates"
const staticdir = __dirname + "/../static"

app.use(require("koa-static")(staticdir, { maxage: 86400000 /*1 day*/ }))
app.use(require("multy")({}))

const Handlebars = require("handlebars")
const dayjs = require("dayjs")
require("dayjs/locale/de")

dayjs.locale("de")

const db = require("./database")

const VOTING_NAME = process.env["VOTING_NAME"]
const VOTING_NAME_CAPITALIZED = VOTING_NAME ? (VOTING_NAME[0].toUpperCase() + VOTING_NAME.substr(1)) : ""
const COOKIE_NAME = VOTING_NAME ? `hasvoted-${VOTING_NAME}` : "hasvoted"

db.connect().then(db.initialize).then(() => {
  app.listen(8083)
  console.log("listening on :8083")
})

Handlebars.registerHelper("ifeq", function (a, b, options) {
      if (a == b) { return options.fn(this) }
      return options.inverse(this)
})

app.use(async (ctx, next) => {
  try {
    await next();
  } catch (err) {
    const data = {
      votingname: VOTING_NAME_CAPITALIZED,
      message: err.message,
      tryagain: err.tryagain
    }
    ctx.body = await Handlebars.compile(fs.readFileSync(templatedir + "/error.html").toString())(data)
  }
})

const DATE_MIN = process.env["DATE_MIN"]
const DATE_MAX = process.env["DATE_MAX"]
const DATE_FORMAT = "D. MMM. YYYY"

function outOfDateRange() {
  let currentDate = new Date().toISOString().substr(0,10)
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
  if(rangeinfo === 1) { //to not confuse with true
    ctx.throw(403, `Abstimmung wieder geschlossen`, {tryagain: false})
  }
  if(rangeinfo == -1) {
    ctx.throw(403, `Abstimmung noch geschlossen.<br>Sie öffnet am ${dayjs(DATE_MIN).format(DATE_FORMAT)}.`, {tryagain: false})
  }
  return true
}

app.use(async ctx => {
  if(ctx.url == "/vote") {
    checkDateRange(ctx)

    let data = {
      datemax: DATE_MAX ? dayjs(DATE_MAX).format(DATE_FORMAT) : undefined,
      votingname: VOTING_NAME_CAPITALIZED,
      options: await db.getVotes()
    }
    ctx.body = await Handlebars.compile(fs.readFileSync(templatedir + "/vote.html").toString())(data)

  } else if(ctx.url == "/submit") {
    checkDateRange(ctx)

    if (ctx.cookies.get(COOKIE_NAME)) {
      console.log(`${new Date().toISOString()}: error: already voted (cookie)`)
      ctx.throw(401, "Bereits abgestimmt", {tryagain: false})
      return
    }

    const hash = crypt.createHash("sha256")
    hash.update(ctx.ip)
    const hashedip = hash.digest("hex")
    if (await db.hasVoted(hashedip)) {
      console.log(`${new Date().toISOString()}: error: already voted (ip)`)
      ctx.throw(401, "Bereits abgestimmt", {tryagain: false})
      return
    }

    const formdata = ctx.request.body
    if (formdata && Object.keys(formdata).length != 0) {
      if (!formdata["consent"]) {
        console.log(`${new Date().toISOString()}: error: consent not given`)
        ctx.throw(406, "Zustimmung nicht gegeben", {tryagain: true})
        return
      }

      let votes: string[] = []
      Object.keys(formdata).forEach(fieldkey => {
        if (fieldkey != "consent" && formdata[fieldkey].startsWith("on")) {
          votes.push(fieldkey)
        }
      })

      let amount = votes.length
      if (amount == 0) {
        console.log(`${new Date().toISOString()}: error: no options selected`)
        ctx.throw(400, "Gar keine Optionen ausgewählt", {tryagain: true})
        return
      }
      if (amount > 5) {
        console.log(`${new Date().toISOString()}: error: too many options selected`)
        ctx.throw(400, `Zu viele Optionen ausgewählt: ${amount} statt 5 erlaubte`, {tryagain: true})
        return
      }

      let success = await db.castVotes(votes)

      if(!success) {
        console.log(`${new Date().toISOString()}: error: failed to cast vote`)
        ctx.throw(500, "Interner Fehler beim Speichern der Stimmen,<br>kontaktiere bitte den Seitenbetreiber.", {tryagain: true})
        return
      }

      console.log(`${new Date().toISOString()}: successful vote submission`)

      await db.noteVoted(hashedip)
      ctx.cookies.set(COOKIE_NAME,"true");
      ctx.status = 303
      ctx.redirect("/results")
    } else {
      console.log(`${new Date().toISOString()}: error: no form data`)
      ctx.throw(400, "Keine Formulardaten"), {tryagain: true}
    }

  } else if(ctx.url == "/results") {
    let [nvoters, options] = await Promise.all([db.getAmountOfVoters(), db.getSortedVotes()])
    let data = {
      votingname: VOTING_NAME_CAPITALIZED,
      canvote: !outOfDateRange(),
      votingover: outOfDateRange() === 1,
      datemin: DATE_MIN ? dayjs(DATE_MIN).format(DATE_FORMAT) : undefined,
      datemax: DATE_MAX ? dayjs(DATE_MAX).format(DATE_FORMAT) : undefined,
      nvoters,
      options
    }
    ctx.body = await Handlebars.compile(fs.readFileSync(templatedir + "/results.html").toString())(data)

  } else if(ctx.url == "/") {
    ctx.status = 303
    ctx.redirect("/results")

  } else {
    ctx.throw(404, "404 Not found")
  }
})
