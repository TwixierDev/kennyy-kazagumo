const { MongoClient } = require('mongodb');
const { ActivityType } = require('discord.js');

const COLLECTION_NAME = 'bot_presence';
const DOCUMENT_ID = 'bot_presence';
const VALID_STATUS = new Set(['online', 'idle', 'dnd', 'invisible']);

function createPresenceStore({ mongoUri, dbName, log = console.log }) {
  if (!mongoUri) {
    log('[Presence] MongoDB URI not provided; presence persistence disabled.');
    return null;
  }

  const targetDbName = dbName || extractDbName(mongoUri) || 'kenny';
  let mongoClient = null;
  let collection = null;
  let connectPromise = null;

  async function ensureCollection() {
    if (collection) {
      return collection;
    }

    if (!connectPromise) {
      mongoClient = new MongoClient(mongoUri);
      connectPromise = mongoClient
        .connect()
        .then(() => {
          collection = mongoClient.db(targetDbName).collection(COLLECTION_NAME);
          return collection;
        })
        .catch(error => {
          connectPromise = null;
          log(`[Presence] Failed to connect to MongoDB: ${error.message}`);
          throw error;
        });
    }

    return connectPromise;
  }

  async function getConfig() {
    try {
      const col = await ensureCollection();
      const doc = await col.findOne({ _id: DOCUMENT_ID });
      if (!doc) {
        return null;
      }
      const { _id, ...rest } = doc;
      return rest;
    } catch (error) {
      log(`[Presence] Failed to load presence config: ${error.message}`);
      return null;
    }
  }

  async function saveConfig(config = {}) {
    try {
      const col = await ensureCollection();
      await col.updateOne(
        { _id: DOCUMENT_ID },
        { $set: { ...config } },
        { upsert: true }
      );
    } catch (error) {
      log(`[Presence] Failed to save presence config: ${error.message}`);
      throw error;
    }
  }

  async function applyConfig(discordClient, config = {}) {
    if (!discordClient?.user) return;
    const presencePayload = buildPresencePayload(config);
    await discordClient.user.setPresence(presencePayload);
  }

  async function close() {
    if (mongoClient) {
      await mongoClient.close();
      mongoClient = null;
      collection = null;
      connectPromise = null;
    }
  }

  return {
    getConfig,
    saveConfig,
    applyConfig,
    close
  };
}

function buildPresencePayload(config = {}) {
  const status = sanitizeStatusKey(config.status);
  const activityPayload = buildActivityFromConfig(config.activity);
  return {
    status,
    activities: activityPayload ? [activityPayload] : []
  };
}

function buildActivityFromConfig(activityConfig) {
  if (!activityConfig || typeof activityConfig !== 'object') {
    return null;
  }

  const type = String(activityConfig.type || '').toLowerCase();
  const message = typeof activityConfig.message === 'string' ? activityConfig.message : '';

  switch (type) {
    case 'playing':
      return { name: message, type: ActivityType.Playing };
    case 'listening':
      return { name: message, type: ActivityType.Listening };
    case 'watching':
      return { name: message, type: ActivityType.Watching };
    case 'competing':
      return { name: message, type: ActivityType.Competing };
    case 'streaming':
      if (!activityConfig.url) return null;
      return { name: message, type: ActivityType.Streaming, url: activityConfig.url };
    default:
      return null;
  }
}

function serializeActivity(activity) {
  if (!activity) {
    return null;
  }

  const message = activity.name ?? '';

  switch (activity.type) {
    case ActivityType.Playing:
      return { type: 'playing', message };
    case ActivityType.Listening:
      return { type: 'listening', message };
    case ActivityType.Watching:
      return { type: 'watching', message };
    case ActivityType.Competing:
      return { type: 'competing', message };
    case ActivityType.Streaming:
      if (!activity.url) return null;
      return { type: 'streaming', message, url: activity.url };
    default:
      return null;
  }
}

function sanitizeStatusKey(value) {
  if (!value) return 'online';
  const normalized = String(value).toLowerCase();
  return VALID_STATUS.has(normalized) ? normalized : 'online';
}

function extractDbName(uri) {
  if (!uri) return null;
  const match = uri.match(/mongodb(?:\+srv)?:\/\/[^/]+\/(\w+)/i);
  if (match && match[1]) {
    return match[1];
  }
  return null;
}

module.exports = {
  createPresenceStore,
  buildPresencePayload,
  buildActivityFromConfig,
  serializeActivity,
  sanitizeStatusKey
};
