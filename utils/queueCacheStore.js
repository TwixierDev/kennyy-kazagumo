const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hora

function createQueueCacheStore({ log = console.log } = {}) {
  const cache = new Map();

  function saveQueue(guildId, currentTrack, queueTracks) {
    if (!guildId) return;
    
    const tracks = [];
    
    // Add current track first (if exists)
    if (currentTrack) {
      tracks.push(serializeTrack(currentTrack));
    }
    
    // Add queue tracks
    if (queueTracks?.length) {
      for (const track of queueTracks) {
        tracks.push(serializeTrack(track));
      }
    }
    
    if (!tracks.length) return;
    
    cache.set(guildId, {
      tracks,
      savedAt: Date.now(),
      expiresAt: Date.now() + CACHE_TTL_MS
    });
    
    log(`[QueueCache] Saved ${tracks.length} track(s) for guild ${guildId}`);
  }

  function getQueue(guildId) {
    if (!guildId) return null;
    
    const entry = cache.get(guildId);
    if (!entry) return null;
    
    // Check if expired
    if (Date.now() > entry.expiresAt) {
      cache.delete(guildId);
      log(`[QueueCache] Cache expired for guild ${guildId}`);
      return null;
    }
    
    return entry.tracks;
  }

  function clearQueue(guildId) {
    if (!guildId) return;
    cache.delete(guildId);
    log(`[QueueCache] Cleared cache for guild ${guildId}`);
  }

  function hasCache(guildId) {
    if (!guildId) return false;
    const entry = cache.get(guildId);
    if (!entry) return false;
    if (Date.now() > entry.expiresAt) {
      cache.delete(guildId);
      return false;
    }
    return true;
  }

  function getCacheAge(guildId) {
    if (!guildId) return null;
    const entry = cache.get(guildId);
    if (!entry) return null;
    return Date.now() - entry.savedAt;
  }

  // Cleanup expired entries periodically
  const cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [guildId, entry] of cache.entries()) {
      if (now > entry.expiresAt) {
        cache.delete(guildId);
        log(`[QueueCache] Auto-cleanup: expired cache for guild ${guildId}`);
      }
    }
  }, 5 * 60 * 1000); // Every 5 minutes
  
  if (cleanupInterval.unref) cleanupInterval.unref();

  return {
    saveQueue,
    getQueue,
    clearQueue,
    hasCache,
    getCacheAge
  };
}

function serializeTrack(track) {
  if (!track) return null;
  
  return {
    encoded: track.encoded || track.track,
    title: track.title || track.info?.title,
    author: track.author || track.info?.author,
    uri: track.uri || track.info?.uri,
    identifier: track.identifier || track.info?.identifier,
    length: track.length || track.info?.length,
    artworkUrl: track.thumbnail || track.artworkUrl || track.info?.artworkUrl,
    sourceName: track.sourceName || track.info?.sourceName,
    requester: track.requester ? {
      id: track.requester.id,
      username: track.requester.username,
      discriminator: track.requester.discriminator
    } : null
  };
}

module.exports = { createQueueCacheStore };
