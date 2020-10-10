import { multiParserV2 } from "https://deno.land/x/multiparser@v2.0.1/mod.ts"

import { serve, ServerRequest } from "https://deno.land/std@0.61.0/http/server.ts";
import { serveFile } from "https://deno.land/std@0.61.0/http/file_server.ts";
import { getCookies } from "https://deno.land/std@0.61.0/http/cookie.ts";
import { readLines } from "https://deno.land/std@0.61.0/io/bufio.ts";
import { Hash, encode } from "https://deno.land/x/checksum@1.2.0/mod.ts";

import { renderFile } from "https://deno.land/x/mustache/mod.ts";

import * as db from "./database.ts"

const hash = new Hash("md5")

async function serveF(req: ServerRequest, name: string) {
  const content = await serveFile(req,  `${Deno.cwd()}/${name}`)
  req.respond(content)
}

let iphashes: string[] = []

await db.connect()
await db.initialize()

const s = serve({ port: 8083 });
console.log("listening on :8083");
for await (const req of s) {
  if(req.url == "/vote") {
    let data = {options: await db.getVotes()}
    let body = await renderFile("./vote.html", data)
    req.respond({ body: body });

  } else if(req.url == "/submit") {
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
      if (iphashes.includes(hashedip)) {
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

      iphashes.push(hashedip)
      headers.set("Set-Cookie", "voted-abimotto=true");
      headers.set("Location", "/results")
      req.respond({ status: 302, headers })
    } else {
      req.respond({ status: 400, body: "Keine Formulardaten.\nNavigiere bitte zurueck und versuche es erneut." })
    }

  } else if(req.url == "/results") {
    let data = {options: await db.getSortedVotes()}
    let body = await renderFile("./results.html", data)
    req.respond({ body: body });

  } else if(req.url == "/") {
    let headers = new Headers()
    headers.set("Location", "/results")
    req.respond({ status: 302, headers })

  } else if(req.url == "/style.css") {
    serveF(req, "style.css")

  } else {
    req.respond({ body: "404 Not found\n" });
  }
}
