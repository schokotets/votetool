const fs = require("fs")
const crypt = require("crypto")

const Koa = require("koa")
const app = new Koa()
app.proxy = true

app.use(require("koa-static")("./static", { maxage: 86400000 /*1 day*/ }))
app.use(require("multy")({}))

const Mustache = require("mustache")

const db = require("./database")



db.connect().then(db.initialize).then(() => {
  app.listen(8083)
  console.log("listening on :8083")
})

app.use(async ctx => {
  if(ctx.url == "/vote") {
    let data = {options: await db.getVotes()}
    ctx.body = await Mustache.render(fs.readFileSync(__dirname + "/vote.html").toString(), data)

  } else if(ctx.url == "/submit") {
    if (ctx.cookies.get("voted-abimotto")) {
      ctx.throw(401, "Bereits abgestimmt.\nSchau dir die Ergebnisse an.")
      return
    }

    const hash = crypt.createHash("sha256")
    hash.update(ctx.ip)
    const hashedip = hash.digest("hex")
    if (await db.hasVoted(hashedip)) {
      ctx.throw(401, "Bereits abgestimmt.\nSchau dir die Ergebnisse an.")
      return
    }

    const formdata = ctx.request.body
    if (formdata && Object.keys(formdata).length != 0) {
      console.log(formdata)
      if (!formdata["consent"]) {
        ctx.throw(406, "Zustimmung nicht gegeben.\nNavigiere bitte zurueck versuche es erneut.")
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
        ctx.throw(400, `Gar keine Optionen ausgewaehlt.\nNavigiere bitte zurueck und versuche es erneut.`)
        return
      }
      if (amount > 5) {
        ctx.throw(400, `Zu viele Optionen ausgewaehlt (${amount} statt 5 erlaubte).\nNavigiere bitte zurueck und versuche es erneut.`)
        return
      }

      let success = await db.castVotes(votes)

      if(!success) {
        ctx.throw(500, "Interner Fehler beim Speichern der Stimmen.\nKontaktiere bitte den Seitenbetreiber.\nVersuche, zurück zu navigieren und es erneut zu versuchen.")
        return
      }

      console.log(`${new Date().toISOString()}: successful vote submission`)

      await db.noteVoted(hashedip)
      ctx.cookies.set("voted-abimotto","true");
      ctx.status = 303
      ctx.redirect("/results")
    } else {
      ctx.throw(400, "Keine Formulardaten.\nNavigiere bitte zurueck und versuche es erneut.")
    }

  } else if(ctx.url == "/results") {
    let [nvotes, options] = await Promise.all([db.getAmountOfVoters(), db.getSortedVotes()])
    let data = {nvoters: nvotes==1?"Eine Person hat":nvotes+" Personen haben", options}
    ctx.body = await Mustache.render(fs.readFileSync(__dirname + "/results.html").toString(), data)

  } else if(ctx.url == "/") {
    ctx.status = 303
    ctx.redirect("/results")

  } else {
    ctx.throw(404, "404 Not found")
  }
})
