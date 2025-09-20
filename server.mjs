// server.mjs
import express from "express";
import cheerio from "cheerio";

const PORT = process.env.PORT || 8080;

const app = express();

// Enable raw body for non-GETs when proxying
app.use(express.raw({ type: "*/*", limit: "50mb" }));

app.all("*", async (req, res) => {
  try {
    const proto = "https:";
    const originURL = new URL(`${proto}//freepik.com${req.originalUrl}`);

    const blocked = ["/sign-out", "/subscribe/*"];
    const blockedRegex = blocked
      .map((p) => new RegExp("^" + p.replace(/\*/g, ".*") + "$"))
      .concat([/^\/?sign[-_ ]?in(\/.*)?$/i]);
    if (blockedRegex.some((rx) => rx.test(originURL.pathname))) {
      const html = blockedPageHTML();
      return res.status(403).set("content-type", "text/html; charset=UTF-8").send(html);
    }

    const pathLower = originURL.pathname.toLowerCase();
    const BLOCK_EXT =
      /\.(?:png|jpe?g|webp|gif|svg|ico|avif|bmp|tiff?|heic|heif|apng|woff2?|ttf|otf|eot|mp4|webm|ogg|m4v|mov|avi|m3u8|ts|mkv)$/i;

    if (BLOCK_EXT.test(pathLower)) {
      if (/\.(woff2?|ttf|otf|eot)$/.test(pathLower)) {
        return res.status(204).set("x-proxy-blocked", "font").end();
      }
      if (/(mp4|webm|ogg|m4v|mov|avi|m3u8|ts|mkv)$/.test(pathLower)) {
        return res.status(204).set("x-proxy-blocked", "video").end();
      }
      return res.status(204).set("x-proxy-blocked", "image").end();
    }

    const accept = req.headers["accept"] || "";
    const acceptsHTML = /\btext\/html\b|\bapplication\/xhtml\+xml\b|\bapplication\/xml\b/i.test(accept);
    if (!acceptsHTML && /(image\/|video\/|\bfont\/)/i.test(accept)) {
      return res.status(204).set("x-proxy-blocked", "accept").end();
    }

    const out = new Headers();
    for (const [k, v] of Object.entries(req.headers)) {
      if (typeof v === "undefined") continue;
      if (["host", "content-length"].includes(k.toLowerCase())) continue;
      out.set(k, Array.isArray(v) ? v.join(", ") : v);
    }

    out.delete("cookie");
    const cookieFromEnv = (process.env.ENVATO_COOKIE || process.env.envato_COOKIE || "").trim();
    if (cookieFromEnv) out.set("cookie", cookieFromEnv);

    out.set(
      "user-agent",
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36"
    );
    out.set("accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8");
    out.set("accept-language", "en-US,en;q=0.9");
    out.delete("cf-connecting-ip");
    out.delete("x-forwarded-for");
    out.delete("authorization");

    const needBody = !(req.method === "GET" || req.method === "HEAD");
    const body = needBody ? req.body : undefined;

    let originResp;
    try {
      originResp = await fetch(originURL.toString(), {
        method: req.method,
        headers: out,
        redirect: "follow",
        body,
      });
    } catch (e) {
      return res.status(502).send(`Origin fetch failed: ${e}`);
    }

    const respHeaders = {};
    for (const [k, v] of originResp.headers.entries()) {
      if (["set-cookie", "content-security-policy", "content-security-policy-report-only"].includes(k.toLowerCase())) {
        continue;
      }
      respHeaders[k] = v;
    }
    respHeaders["x-content-type-options"] = "nosniff";

    const ct = originResp.headers.get("content-type") || "";
    const status = originResp.status;

    if (ct.includes("text/html")) {
      const text = await originResp.text();
      const $ = cheerio.load(text, { decodeEntities: false });

      $("img, video").each((_, el) => {
        const $el = $(el);
        killAttr($el, ["src", "srcset", "data-src", "data-srcset", "crossorigin"]);
        dropAttr($el, ["loading", "decoding"]);
        if (el.tagName.toLowerCase() === "video") {
          killAttr($el, ["poster"]);
          $el.attr("preload", "none");
          $el.attr("controls", "");
          dropAttr($el, ["autoplay", "loop", "muted"]);
        }
      });

      $("source").each((_, el) => {
        const $el = $(el);
        killAttr($el, ["src", "srcset"]);
      });

      $("track").each((_, el) => {
        const $el = $(el);
        if ($el.attr("src")) $el.attr("src", "");
      });

      $("picture").each((_, el) => {
        const $el = $(el);
        dropAttr($el, ["loading", "decoding"]);
      });

      $("link[rel='preload'][as='video'], link[as='video'], link[rel='preload'][as='image'], link[as='image']").remove();

      const cssInjection = buildCssInjection();
      const jsInjection = buildJsInjection();
      const blockCookiesScript = buildBlockCookiesScript(true);

      if ($("head").length === 0) $("html").prepend("<head></head>");
      if (cssInjection) $("head").append(cssInjection);
      if (blockCookiesScript) $("head").append(blockCookiesScript);
      if (jsInjection) $("head").append(jsInjection);

      return res.status(status).set(respHeaders).send($.html());
    }

    if (originResp.body) {
      res.writeHead(status, respHeaders);
      originResp.body.pipeTo(
        new WritableStream({
          write(chunk) {
            res.write(Buffer.from(chunk));
          },
          close() {
            res.end();
          },
          abort(err) {
            res.end();
          },
        })
      ).catch(() => res.end());
    } else {
      const buf = Buffer.from(await originResp.arrayBuffer());
      res.status(status).set(respHeaders).send(buf);
    }
  } catch (err) {
    res.status(500).send(`Server error: ${err}`);
  }
});

app.listen(PORT, () => {
  console.log(`Proxy running on :${PORT}`);
});

function blockedPageHTML() {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><title>Blocked</title></head><body>Blocked</body></html>`;
}

function killAttr($el, names) {
  for (const n of names) {
    if ($el.attr(n) !== undefined) $el.attr(n, "");
  }
}
function dropAttr($el, names) {
  for (const n of names) {
    if ($el.attr(n) !== undefined) $el.removeAttr(n);
  }
}

function buildCssInjection() { return `<style></style>`; }
function buildJsInjection() { return `<script></script>`; }
function buildBlockCookiesScript(hideReads = true) { return `<script></script>`; }
function escapeAttr(str = "") { return str; }
