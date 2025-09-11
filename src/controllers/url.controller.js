const { customAlphabet } = require("nanoid");
const MinHeap = require("heap-js").default; // log(n) insertion, deletion for ttl management
const Denque = require("denque"); //storing access times for a url
const { set } = require("../app");

const baseUrl = "http://localhost:3000/api/urls"; // TODO: from config/env
const defaultTTL = parseInt(process.env.DEFAULT_TTL_SECOND) || 120;
const nanoidAlphabet = process.env.NANOID_ALPHABET;
const nanoidSize = parseInt(process.env.NANOID_SIZE);
const MAX_ACCESS_TIMES = 10;

const nanoid = customAlphabet(nanoidAlphabet, nanoidSize);

// url schema
// - alias
// - longUrl
// - createdAt
// - expiresAt
// - accessTimes (deque)
// - ver

const aliasStore = new Map(); // alias -> url
const ttlHeap = new MinHeap((a, b) => a.expiresAt - b.expiresAt);

// helpers
function generateAlias() {
  let alias;
  do {
    alias = nanoid();
  } while (aliasStore.has(alias));
  console.log("Generated alias:", alias);
  return alias;
}

function isValidUrl(url) {
  try {
    new URL(url);
    return true;
  } catch (err) {
    return false;
  }
}

function isValidAlias(s) {
  return /^[A-Za-z0-9_-]{1,64}$/.test(s);
}

function toIsoArray(times) {
  // works for Denque or plain array
  const arr =
    typeof times.toArray === "function" ? times.toArray() : [...times];
  return arr.map((ts) => new Date(ts).toISOString());
}

async function shortenUrl(req, res) {
  const { long_url, custom_alias, ttl_seconds } = req.body || {};

  // validations TODO:
  if (!long_url || !isValidUrl(long_url)) {
    return res
      .status(400)
      .json({ success: false, message: "Invalid long_url" });
  }
  if (custom_alias && !isValidAlias(custom_alias)) {
    return res
      .status(400)
      .json({ success: false, message: "Invalid custom_alias format" });
  }

  // creating alias/custom alias
  let alias = custom_alias || generateAlias();
  if (custom_alias && aliasStore.has(custom_alias)) {
    return res
      .status(409)
      .json({ success: false, message: "Custom alias already in use" });
  }

  // setting ttl
  const ttlSec = Number.isFinite(Number(ttl_seconds))
    ? Number(ttl_seconds)
    : defaultTTL;
  console.log("TTL seconds:", ttlSec);
  const now = Date.now();
  const expiresAt = now + ttlSec * 1000; // in ms
  console.log(
    `Setting TTL for ${ttlSec} seconds, expiresAt: ${new Date(
      expiresAt
    ).toISOString()}`
  );

  // storing url
  const rec = {
    alias,
    longUrl: long_url,
    createdAt: now,
    expiresAt,
    accessCount: 0,
    accessTimes: new Denque(),
    ver: 0,
  };

  aliasStore.set(alias, rec);
  ttlHeap.push({ alias, expiresAt, ver: rec.ver }); // for ttl management

  //   const short_url = `${baseUrl}/${alias}`;
  const short_url = `${baseUrl.replace(/\/$/, "")}/${encodeURIComponent(
    alias
  )}`;

  return res.status(201).json({
    success: true,
    data: { short_url },
  });
}

// background ttl worker
setInterval(() => {
  const now = Date.now();
  while (ttlHeap.size() && ttlHeap.peek().expiresAt <= now) {
    const { alias, ver } = ttlHeap.pop();
    const rec = aliasStore.get(alias);
    if (!rec || rec.ver !== ver) {
      continue; // if the record was updated or deleted then ignore
    }
    aliasStore.delete(alias);
    console.log(`Alias ${alias} expired and removed`);
  }
}, 1000);

// REDIRECTING
const redirectUrl = (req, res) => {
  try {
    const { alias } = req.params;
    if (!alias || !isValidAlias(alias)) {
      return res.status(400).json({ success: false, message: "Invalid alias" });
    }

    const rec = aliasStore.get(alias);
    const now = Date.now();

    // alr expired or not present
    if (!rec || rec.expiresAt <= now) {
      if (rec && rec.expiresAt <= now) {
        aliasStore.delete(alias);
        console.log(`Alias ${alias} expired and removed`);
      }
      return res
        .status(404)
        .json({ success: false, message: "Alias not found or has expired" });
    }

    rec.accessCount += 1;

    // store access time
    if (rec.accessTimes && typeof rec.accessTimes.push === "function") {
      rec.accessTimes.push(now);
      if (rec.accessTimes.size && rec.accessTimes.size() > MAX_ACCESS_TIMES) {
        rec.accessTimes.shift();
      } else if (
        Array.isArray(rec.accessTimes) &&
        rec.accessTimes.length > MAX_ACCESS_TIMES
      ) {
        rec.accessTimes.shift();
      }
    }

    return res.redirect(302, rec.longUrl);
  } catch (err) {
    console.error("redirectByAlias error:", err);
    return res.status(500).send("Internal error");
  }
};

// ANALYTICS - TODO:
const getAnalytics = (req, res) => {
  try {
    const { alias } = req.params;
    const rec = aliasStore.get(alias);
    const now = Date.now();

    // record not found or expired
    if (!rec || rec.expiresAt <= now) {
      if (rec && rec.expiresAt <= now) aliasStore.delete(alias);
      return res
        .status(404)
        .json({ success: false, message: "Alias not found or expired" });
    }

    return res.status(200).json({
      success: true,
      data: {
        alias: rec.alias,
        long_url: rec.longUrl,
        accessCount: rec.accessCount,
        accessTimes: toIsoArray(rec.accessTimes), // last 10 access timestamps
      },
    });
  } catch (err) {
    console.error("getAnalytics error:", err);
    return res.status(500).json({ success: false, message: "Internal error" });
  }
};

const updateAlias = (req, res) => {
  try {
    const { alias } = req.params;
    const { custom_alias, ttl_seconds } = req.body || {};
    const rec = aliasStore.get(alias);
    const now = Date.now();

    // check expiry
    if (!rec || rec.expiresAt <= now) {
      if (rec && rec.expiresAt <= now) aliasStore.delete(alias);
      return res
        .status(404)
        .json({ success: false, message: "Alias not found or expired" });
    }

    if (custom_alias) {
      if (!isValidAlias(custom_alias)) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid custom_alias format" });
      }
      if (custom_alias !== alias && aliasStore.has(custom_alias)) {
        return res
          .status(409)
          .json({ success: false, message: "Custom alias already in use" });
      }
    }

    // new ttl
    const ttlProvided = ttl_seconds !== undefined && ttl_seconds !== null;
    const ttlMs = ttlProvided
      ? Math.max(1, Number(ttl_seconds)) * 1000
      : undefined;

    if (custom_alias && custom_alias !== alias) {
      const remainingTtl = rec.expiresAt - now;
      const newExpiresAt =
        now + (ttlProvided ? ttlMs : remainingTtl || defaultTTL * 1000);

      const newRec = {
        alias: custom_alias,
        longUrl: rec.longUrl,
        createdAt: now,
        expiresAt: newExpiresAt,
        accessCount: 0,
        accessTimes: new Denque(), // reset analytics on alias change
        ver: 0,
      };

      aliasStore.set(custom_alias, newRec);
      ttlHeap.push({
        alias: custom_alias,
        expiresAt: newRec.expiresAt,
        ver: newRec.ver,
      });

      aliasStore.delete(alias); // remove old
      //   rec.ver += 1;

      return res.status(200).json({
        success: true,
        data: {
          alias: newRec.alias,
          long_url: newRec.longUrl,
          expires_at: new Date(newRec.expiresAt).toISOString(),
        },
      });
    }

    // only ttl update
    if (ttlProvided) {
      rec.expiresAt = now + ttlMs;
      rec.ver += 1;
      ttlHeap.push({ alias, expiresAt: rec.expiresAt, ver: rec.ver });

      return res.status(200).json({
        success: true,
        data: { alias, expires_at: new Date(rec.expiresAt).toISOString() },
      });
    }

    // nothing provided :(
    return res.status(400).json({
      success: false,
      message: "Nothing to update. Provide custom_alias and/or ttl_seconds.",
    });
  } catch (err) {
    console.error("updateAlias error:", err);
    return res.status(500).json({ success: false, message: "Internal error" });
  }
};

const deleteAlias = (req, res) => {
  try {
    const { alias } = req.params;
    const rec = aliasStore.get(alias);

    if (!rec) {
      return res
        .status(404)
        .json({ success: false, message: "Alias not found" });
    }

    aliasStore.delete(alias);

    // delete from heap - lazy deletion

    return res.status(200).json({
      success: true,
      data: {
        alias,
        message:
          rec.expiresAt <= Date.now() ? "Deleted (was expired)" : "Deleted",
      },
    });
  } catch (err) {
    console.error("deleteAlias error:", err);
    return res.status(500).json({ success: false, message: "Internal error" });
  }
};

module.exports = {
  shortenUrl,
  redirectUrl,
  getAnalytics,
  updateAlias,
  deleteAlias,
};
