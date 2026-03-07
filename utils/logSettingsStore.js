const { MongoClient } = require('mongodb');

const COLLECTION_NAME = 'log_settings';
const DOCUMENT_ID = 'music_logs';

function createLogSettingsStore({ mongoUri, dbName, log = console.log }) {
  if (!mongoUri) {
    log('[Logs] MongoDB URI not provided; log toggles disabled.');
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
          log(`[Logs] Failed to connect to MongoDB: ${error.message}`);
          throw error;
        });
    }

    return connectPromise;
  }

  async function isMusicLogsEnabled() {
    try {
      const col = await ensureCollection();
      const doc = await col.findOne({ _id: DOCUMENT_ID });
      return Boolean(doc?.enabled);
    } catch (error) {
      log(`[Logs] Failed to read log settings: ${error.message}`);
      return false;
    }
  }

  async function setMusicLogsEnabled(enabled) {
    try {
      const col = await ensureCollection();
      await col.updateOne(
        { _id: DOCUMENT_ID },
        { $set: { enabled: Boolean(enabled) } },
        { upsert: true }
      );
    } catch (error) {
      log(`[Logs] Failed to persist log settings: ${error.message}`);
      throw error;
    }
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
    isMusicLogsEnabled,
    setMusicLogsEnabled,
    close
  };
}

function extractDbName(uri) {
  if (!uri) return null;
  const match = uri.match(/mongodb(?:\+srv)?:\/\/[^/]+\/(\w+)/i);
  if (match && match[1]) {
    return match[1];
  }
  return null;
}

module.exports = { createLogSettingsStore };
