import { multiParserV2 } from "https://deno.land/x/multiparser@v2.0.1/mod.ts"

import { serve, ServerRequest } from "https://deno.land/std@0.61.0/http/server.ts";
import { serveFile } from "https://deno.land/std@0.61.0/http/file_server.ts";
import { getCookies } from "https://deno.land/std@0.61.0/http/cookie.ts";
import { readLines } from "https://deno.land/std@0.61.0/io/bufio.ts";
import { Hash, encode } from "https://deno.land/x/checksum@1.2.0/mod.ts";

import { renderFile } from "https://deno.land/x/mustache/mod.ts";

const hash = new Hash("md5")

async function serveF(req: ServerRequest, name: string) {
  const content = await serveFile(req,  `${Deno.cwd()}/${name}`)
  req.respond(content)
}

let iphashes: string[] = []

let data = {
  options: [
    {id: 0, name: "funky kids", votes: 4},
    {id: 1, name: "no kids", votes: 3},
    {id: 2, name: "super kids", votes: 1},
    {id: 3, name: "funny kids", votes: 0},
    {id: 4, name: "dorky kids", votes: 7},
    {id: 5, name: "nerdy kids", votes: 4},
    {id: 6, name: "kind kids", votes: 7},
    {id: 7, name: "great kids", votes: 6},
    {id: 8, name: "school kids", votes: 1},
    {id: 9, name: "cool kids", votes: 1},
    {id: 10, name: "big dreams", votes: 2}
  ]
}

const s = serve({ port: 8083 });
console.log("http://localhost:8083/");
for await (const req of s) {
  if(req.url == "/vote") {
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

      data.options = data.options.map(item => {
        if (item.id in votes) {
          item.votes += 1
        }
        return item
      })

      console.log(`${new Date().toISOString()}: successful vote submission`)

      iphashes.push(hashedip)
      headers.set("Set-Cookie", "voted-abimotto=true");
      headers.set("Location", "/results")
      req.respond({ status: 302, headers })
    } else {
      req.respond({ status: 400, body: "Keine Formulardaten.\nNavigiere bitte zurueck und versuche es erneut." })
    }

  } else if(req.url == "/results") {
    let sorteddata = {options:data.options.sort((a,b) => (b.votes - a.votes))}
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
