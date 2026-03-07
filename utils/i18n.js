const fs = require('node:fs');
const path = require('node:path');
const { MongoClient, Long } = require('mongodb');

const DEFAULT_CACHE_TTL = 5 * 60 * 1000;

function createI18n({
  localesDir,
  defaultLocale = 'en',
  mongoUri,
  dbName,
  collectionName = 'guild_languages',
  cacheTtl = DEFAULT_CACHE_TTL,
  log = console.log
}) {
  const locales = loadLocales(localesDir, log);
  if (!locales[defaultLocale]) {
    throw new Error(`Default locale "${defaultLocale}" was not found in ${localesDir}`);
  }

  const guildCache = new Map();
  let mongoClient = null;
  let languagesCollection = null;
  let connectPromise = null;

  async function ensureCollection() {
    if (languagesCollection) {
      return languagesCollection;
    }

    if (!mongoUri) {
      throw new Error('Missing MONGODB_URI for language storage.');
    }

    if (!connectPromise) {
      connectPromise = MongoClient.connect(mongoUri)
        .then(client => {
          mongoClient = client;
          const targetDbName = dbName || extractDbName(mongoUri) || 'kenny';
          const db = client.db(targetDbName);
          languagesCollection = db.collection(collectionName);
          return languagesCollection;
        })
        .catch(error => {
          connectPromise = null;
          throw error;
        });
    }

    return connectPromise;
  }

  async function getGuildLanguage(guildId) {
    if (!guildId) return defaultLocale;
    const cacheEntry = guildCache.get(guildId);
    if (cacheEntry && cacheEntry.expires > Date.now()) {
      return cacheEntry.value;
    }

    try {
      const collection = await ensureCollection();
      const doc = await collection.findOne(buildGuildFilter(guildId));
      const language = doc?.language || defaultLocale;
      guildCache.set(guildId, { value: language, expires: Date.now() + cacheTtl });
      return language;
    } catch (error) {
      log(`[i18n] Failed to resolve language for guild ${guildId}: ${error.message}`);
      return defaultLocale;
    }
  }

  async function setGuildLanguage(guildId, language) {
    if (!guildId) return;
    if (!locales[language]) {
      throw new Error(`Locale "${language}" is not available.`);
    }

    try {
      const collection = await ensureCollection();
      await collection.updateOne(
        { guild_id: normalizeGuildIdForWrite(guildId) },
        { $set: { guild_id: normalizeGuildIdForWrite(guildId), language } },
        { upsert: true }
      );
      guildCache.set(guildId, { value: language, expires: Date.now() + cacheTtl });
    } catch (error) {
      log(`[i18n] Failed to persist language for guild ${guildId}: ${error.message}`);
      throw error;
    }
  }

  function translate(locale, key, variables = {}) {
    const data = locales[locale] || locales[defaultLocale];
    const segments = key.split('.');
    let value = segments.reduce((acc, segment) => (acc && acc[segment] !== undefined ? acc[segment] : undefined), data);

    if (value === undefined && locale !== defaultLocale) {
      value = segments.reduce((acc, segment) => (acc && acc[segment] !== undefined ? acc[segment] : undefined), locales[defaultLocale]);
    }

    if (typeof value !== 'string') {
      return key;
    }

    return value.replace(/\{(\w+)\}/g, (_, token) => {
      const replacement = variables[token];
      return replacement === undefined ? `{${token}}` : String(replacement);
    });
  }

  async function getFixedT(guildId) {
    const locale = await getGuildLanguage(guildId);
    return (key, variables) => translate(locale, key, variables);
  }

  function getAvailableLocales() {
    return Object.keys(locales);
  }

  async function close() {
    if (mongoClient) {
      await mongoClient.close();
      mongoClient = null;
      languagesCollection = null;
      connectPromise = null;
    }
  }

  return {
    getGuildLanguage,
    setGuildLanguage,
    getFixedT,
    t: translate,
    getAvailableLocales,
    close
  };
}

function loadLocales(dir, log) {
  const locales = {};
  if (!dir || !fs.existsSync(dir)) {
    throw new Error(`Locales directory not found: ${dir}`);
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.json')) continue;
    const localeCode = entry.name.replace(/\.json$/i, '');
    try {
      const filePath = path.join(dir, entry.name);
      const content = fs.readFileSync(filePath, 'utf8');
      locales[localeCode] = JSON.parse(content);
    } catch (error) {
      log(`[i18n] Failed to load locale ${entry.name}: ${error.message}`);
    }
  }
  return locales;
}

function extractDbName(uri) {
  if (!uri) return null;
  const match = uri.match(/mongodb(?:\+srv)?:\/\/[^/]+\/(\w+)/i);
  if (match && match[1]) {
    return match[1];
  }
  return null;
}

function buildGuildFilter(guildId) {
  const variants = buildGuildIdVariants(guildId);
  if (variants.length === 1) {
    return { guild_id: variants[0] };
  }
  return { guild_id: { $in: variants } };
}

function buildGuildIdVariants(guildId) {
  const variants = [];
  const asString = guildId?.toString?.() ?? String(guildId ?? '');
  if (asString) {
    variants.push(asString);
  }
  try {
    const asLong = Long.fromString(asString);
    variants.push(asLong);
  } catch (error) {
    // Ignore parsing errors; fallback to string variant only.
  }
  return variants.length ? variants : [guildId];
}

function normalizeGuildIdForWrite(guildId) {
  const asString = guildId?.toString?.() ?? String(guildId ?? '');
  try {
    return Long.fromString(asString);
  } catch (error) {
    return asString;
  }
}

module.exports = { createI18n };
