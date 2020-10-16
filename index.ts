const fs = require("fs")
const crypt = require("crypto")

const Koa = require("koa")
const app = new Koa()
app.proxy = true

app.use(require("koa-static")("./static", { maxage: 86400000 /*1 day*/ }))
app.use(require("multy")({}))

const Handlebars = require("handlebars")

const db = require("./database")

const VOTING_NAME = process.env["VOTING_NAME"]
const COOKIE_NAME = VOTING_NAME ? `hasvoted-${VOTING_NAME}` : "hasvoted"

db.connect().then(db.initialize).then(() => {
  app.listen(8083)
  console.log("listening on :8083")
})


app.use(async (ctx, next) => {
  try {
    await next();
  } catch (err) {
    const data = {
      votingname: VOTING_NAME ? (VOTING_NAME[0].toUpperCase() + VOTING_NAME.substr(1)) : "",
      message: err.message,
      tryagain: err.tryagain
    }
    ctx.body = await Handlebars.compile(fs.readFileSync(__dirname + "/error.html").toString())(data)
  }
})

app.use(async ctx => {
  if(ctx.url == "/vote") {
    let data = {
      votingname: VOTING_NAME ? (VOTING_NAME[0].toUpperCase() + VOTING_NAME.substr(1)) : "",
      options: await db.getVotes()
    }
    ctx.body = await Handlebars.compile(fs.readFileSync(__dirname + "/vote.html").toString())(data)

  } else if(ctx.url == "/submit") {
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
        ctx.throw(500, "Interner Fehler beim Speichern der Stimmen,\nkontaktiere bitte den Seitenbetreiber.", {tryagain: true})
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
    let [nvotes, options] = await Promise.all([db.getAmountOfVoters(), db.getSortedVotes()])
    let data = {
      votingname: VOTING_NAME ? (VOTING_NAME[0].toUpperCase() + VOTING_NAME.substr(1)) : "",
      nvoters: nvotes==1?"Eine Person hat":nvotes+" Personen haben",
      options
    }
    ctx.body = await Handlebars.compile(fs.readFileSync(__dirname + "/results.html").toString())(data)

  } else if(ctx.url == "/") {
    ctx.status = 303
    ctx.redirect("/results")

  } else {
    ctx.throw(404, "404 Not found")
  }
})
