const Koa = require("koa")
const app = new Koa();

await db.connect()
await db.initialize()

app.use(require('koa-static')("./static", { maxage: 86400000 /*1 day*/ }));
const s = app.listen(8083);
console.log("listening on :8083");

app.use(async ctx => {
  if(ctx.url == "/vote") {
    let data = {options: await db.getVotes()}
    let body = await renderFile("./vote.html", data)
    req.respond({ body: body });

  } else if(ctx.url == "/submit") {
    let headers = new Headers()

    let cookies = getCookies(req)
    if ("voted-abimotto" in cookies) {
      req.respond({ status: 401, body: "Bereits abgestimmt.\nSchau dir die Ergebnisse an." })
      continue
    }

    let hashedip
    if(req.conn.remoteAddr.transport == "tcp") {
      const ip = req.conn.remoteAddr.hostname
      hashedip = hash.digest(encode(ip)).hex()
      if (await db.hasVoted(hashedip)) {
        req.respond({ status: 401, body: "Bereits abgestimmt.\nSchau dir die Ergebnisse an." })
        continue
      }
    }

    const form = await multiParserV2(req)
    if (form) {
      if (!form.fields["consent"]) {
        req.respond({ status: 406, body: "Zustimmung nicht gegeben.\nNavigiere bitte zurueck versuche es erneut." })
        continue
      }

      let votes: string[] = []
      Object.keys(form.fields).forEach(fieldkey => {
        if (fieldkey != "consent" && form.fields[fieldkey].startsWith("on")) {
          votes.push(fieldkey)
        }
      })

      let amount = votes.length
      if (amount == 0) {
        req.respond({ status: 400, body: `Gar keine Optionen ausgewaehlt.\nNavigiere bitte zurueck und versuche es erneut.` })
        continue
      }
      if (amount > 5) {
        req.respond({ status: 400, body: `Zu viele Optionen ausgewaehlt (${amount} statt 5 erlaubte).\nNavigiere bitte zurueck und versuche es erneut.` })
        continue
      }

      let success = await db.castVotes(votes)

      if(!success) {
        req.respond({ status: 500, body: "Interner Fehler beim Speichern der Stimmen.\nKontaktiere bitte den Seitenbetreiber.\nVersuche, zurück zu navigieren und es erneut zu versuchen." })
        continue
      }

      console.log(`${new Date().toISOString()}: successful vote submission`)

      await db.noteVoted(hashedip)
      headers.set("Set-Cookie", "voted-abimotto=true");
      headers.set("Location", "/results")
      req.respond({ status: 302, headers })
    } else {
      req.respond({ status: 400, body: "Keine Formulardaten.\nNavigiere bitte zurueck und versuche es erneut." })
    }

  } else if(ctx.url == "/results") {
    let data = {options: await db.getSortedVotes()}
    let body = await renderFile("./results.html", data)
    req.respond({ body: body });

  } else if(ctx.url == "/") {
    let headers = new Headers()
    headers.set("Location", "/results")
    req.respond({ status: 302, headers })

  } else {
    req.respond({ body: "404 Not found\n" });
  }
})
