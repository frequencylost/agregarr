// @server/api/animeIds.ts
// Loads PlexAniBridge Anime ID mappings (improved over Kometa's Anime-IDs)
// https://github.com/eliasbenb/PlexAniBridge-Mappings

export type AnimeIdsRow = {
  anidb_id?: number; // AniDB ID
  anilist_id?: number; // AniList ID (also the primary key)
  mal_id?: number | number[]; // MyAnimeList ID(s) - can be single or array
  imdb_id?: string | string[]; // IMDB ID(s) - format: "tt1234567" - can be single or array
  tmdb_movie_id?: number | number[]; // TMDB Movie ID(s) - can be single or array
  tmdb_show_id?: number; // TMDB Show ID - always single
  tvdb_id?: number; // TVDB ID - always single
  tmdb_mappings?: Record<string, string>; // TMDB season mappings (e.g., {"s1": "e1-e12|2"})
  tvdb_mappings?: Record<string, string>; // TVDB season mappings
};

type RawAnimeIds = Record<string, AnimeIdsRow>; // keyed by AniList ID

let _loadedAt = 0;
let _byAniList = new Map<number, AnimeIdsRow>();
let _byAniDB = new Map<number, AnimeIdsRow>(); // For AniDB lookups
let _byMal = new Map<number, AnimeIdsRow>(); // For MAL lookups
let _byTvdb = new Map<number, AnimeIdsRow>(); // For Plex GUID -> AniList lookups
let _byTmdbMovie = new Map<number, AnimeIdsRow>();
let _byTmdbShow = new Map<number, AnimeIdsRow>();
let _byImdb = new Map<string, AnimeIdsRow>(); // imdb id lowercased
let _loadInFlight: Promise<void> | null = null;

// Normalize array fields to always be arrays for consistent handling
function normalizeToArray<T>(value: T | T[] | undefined): T[] {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

// Get first value from a field that can be single value or array
export function getFirstValue<T>(value: T | T[] | undefined): T | undefined {
  if (value == null) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

// Get all values from a field that can be single value or array
export function getAllValues<T>(value: T | T[] | undefined): T[] {
  return normalizeToArray(value);
}

// Maximum allowed response size (50MB - the mapping file is typically ~10-20MB)
const MAX_RESPONSE_SIZE = 50 * 1024 * 1024;
// Request timeout (30 seconds)
const FETCH_TIMEOUT_MS = 30000;

export async function loadAnimeIds(
  url = 'https://raw.githubusercontent.com/eliasbenb/PlexAniBridge-Mappings/refs/heads/v2/mappings.json'
): Promise<void> {
  // Create abort controller for timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
      // be explicit that we want fresh-ish
      cache: 'no-store' as RequestCache,
      signal: controller.signal,
    });

    if (!res.ok) throw new Error(`Anime-IDs fetch failed: ${res.status}`);

    // Check content-length if provided to reject obviously oversized responses
    const contentLength = res.headers.get('content-length');
    if (contentLength && parseInt(contentLength, 10) > MAX_RESPONSE_SIZE) {
      throw new Error(
        `Anime-IDs response too large: ${contentLength} bytes (max: ${MAX_RESPONSE_SIZE})`
      );
    }

    // Stream response with size enforcement to prevent memory exhaustion
    const reader = res.body?.getReader();
    if (!reader) {
      throw new Error('Anime-IDs response body is not readable');
    }

    const chunks: Uint8Array[] = [];
    let totalBytes = 0;

    try {
      // eslint-disable-next-line no-constant-condition -- standard streaming read pattern
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        totalBytes += value.length;
        if (totalBytes > MAX_RESPONSE_SIZE) {
          controller.abort();
          throw new Error(
            `Anime-IDs response too large: exceeded ${MAX_RESPONSE_SIZE} bytes during download`
          );
        }
        chunks.push(value);
      }
    } finally {
      reader.releaseLock();
    }

    // Combine chunks and decode as UTF-8
    const combined = new Uint8Array(totalBytes);
    let offset = 0;
    for (const chunk of chunks) {
      combined.set(chunk, offset);
      offset += chunk.length;
    }
    const text = new TextDecoder().decode(combined);

    const json = JSON.parse(text) as RawAnimeIds;

    const byAniList = new Map<number, AnimeIdsRow>();
    const byAniDB = new Map<number, AnimeIdsRow>();
    const byMal = new Map<number, AnimeIdsRow>();
    const byTvdb = new Map<number, AnimeIdsRow>();
    const byTmdbMovie = new Map<number, AnimeIdsRow>();
    const byTmdbShow = new Map<number, AnimeIdsRow>();
    const byImdb = new Map<string, AnimeIdsRow>();

    // Build indices - keys are now AniList IDs directly!
    for (const [anilistIdStr, row] of Object.entries(json)) {
      // Skip metadata keys like "$includes"
      if (anilistIdStr.startsWith('$')) continue;

      const anilistId = parseInt(anilistIdStr);
      if (!anilistId || !Number.isFinite(anilistId)) continue;

      // Store the row as-is (already well-structured)
      const normalized: AnimeIdsRow = {
        ...row,
        anilist_id: anilistId, // Add the key as a field for completeness
      };

      // Store by AniList ID (primary key)
      byAniList.set(anilistId, normalized);

      // Also index by AniDB ID if present
      if (row.anidb_id) {
        byAniDB.set(row.anidb_id, normalized);
      }

      // Also index by MAL ID(s) if present
      const malIds = normalizeToArray(row.mal_id);
      for (const malId of malIds) {
        byMal.set(malId, normalized);
      }

      // Reverse indexes: from Plex-side IDs back to the AniList row
      if (row.tvdb_id != null) {
        byTvdb.set(row.tvdb_id, normalized);
      }
      const tmdbMovieIds = normalizeToArray(row.tmdb_movie_id);
      for (const id of tmdbMovieIds) {
        byTmdbMovie.set(id, normalized);
      }
      if (row.tmdb_show_id != null) {
        byTmdbShow.set(row.tmdb_show_id, normalized);
      }
      const imdbIds = normalizeToArray(row.imdb_id);
      for (const id of imdbIds) {
        if (typeof id === 'string') {
          byImdb.set(id.toLowerCase(), normalized);
        }
      }
    }

    _byAniList = byAniList;
    _byAniDB = byAniDB;
    _byMal = byMal;
    _byTvdb = byTvdb;
    _byTmdbMovie = byTmdbMovie;
    _byTmdbShow = byTmdbShow;
    _byImdb = byImdb;
    _loadedAt = Date.now();
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function ensureAnimeIdsLoaded(
  ttlMs = 12 * 60 * 60 * 1000
): Promise<void> {
  const stale = Date.now() - _loadedAt > ttlMs;
  if (_byAniList.size > 0 && !stale) return;
  if (_loadInFlight) return _loadInFlight;
  _loadInFlight = loadAnimeIds().finally(() => (_loadInFlight = null));
  return _loadInFlight;
}

export function lookupByAniList(anilistId: number): AnimeIdsRow | undefined {
  return _byAniList.get(anilistId);
}

/** Lookup PlexAniBridge row by MyAnimeList ID (mal_id). */
export function lookupByMal(malId: number): AnimeIdsRow | undefined {
  if (!malId) return undefined;
  return _byMal.get(malId);
}

/** Lookup PlexAniBridge row by AniDB ID */
export function lookupByAniDB(anidbId: number): AnimeIdsRow | undefined {
  return _byAniDB.get(anidbId);
}

/** Lookup PlexAniBridge row by TVDB ID (used for reverse Plex -> AniList lookups). */
export function lookupByTvdb(tvdbId: number): AnimeIdsRow | undefined {
  if (!tvdbId) return undefined;
  return _byTvdb.get(tvdbId);
}

/** Lookup PlexAniBridge row by TMDB ID. Tries movie index first, falls back to show. */
export function lookupByTmdb(
  tmdbId: number,
  type?: 'movie' | 'show'
): AnimeIdsRow | undefined {
  if (!tmdbId) return undefined;
  if (type === 'movie') return _byTmdbMovie.get(tmdbId);
  if (type === 'show') return _byTmdbShow.get(tmdbId);
  return _byTmdbMovie.get(tmdbId) ?? _byTmdbShow.get(tmdbId);
}

/** Lookup PlexAniBridge row by IMDb ID (case-insensitive). */
export function lookupByImdb(imdbId: string): AnimeIdsRow | undefined {
  if (!imdbId) return undefined;
  return _byImdb.get(imdbId.toLowerCase());
}

export function animeIdsLoadedCount(): number {
  return _byAniList.size;
}
