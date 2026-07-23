# Agregarr

Agregarr keeps your Plex Home and Recommended fresh by frequently updating it with Collections from various sources, including Trakt, IMDb, TMDB, Letterboxd, MDBList, FlixPatrol (Networks Top 10), AniList and MyAnimeList, as well as generated Collections from Tautulli Statistics, and Overseerr Requests. It has various options for downloading missing media, including as requests through Overseerr, or directly through Radarr/Sonarr. Collections can be reordered on the Home/Recommended and Library tabs independently, and can have time periods or days set for their visibility in Plex.

## Features

- **Public Lists**: Add public lists from Trakt, IMDb, TMDB, Letterboxd, MDBList, FlixPatrol (Networks Top 10), AniList and MyAnimeList, with presets and custom list options.
- **Grab Missing Items**: Missing items from lists can be added via Radarr/Sonarr or Overseerr, with various filters available including release year, season count, list position, genre, and origin country
- **Coming Soon**: Create Coming Soon Collections based off monitored content in Radarr/Sonarr, or anticipated releases from Trakt, complete with trailers and poster overlays.
- **Overseerr Requests**: Generate Collections either for each users requests (only visible to that user), or for All Requests
- **Tautulli Statistics**: Generate Collections based on the Most Popular content on your server
- **Independent Reordering**: Control the order in which Collections appear across the Home/Recommended screens and the Library tab independently
- **Keeps Plex Updated**: Collections will be be updated on every sync (default 12 hours, custom scheduling available). Custom sync options available per-collection.
- **Randomise Home Order**: Keep your home screen dynamic by rotating the order in which collections appear (separate scheduling available)
- **Template System**: Easily set collection names with flexible templating and title importing from lists.
- **Time Restrictions**: Schedule collections to be active only during specific time periods
- **Existing Collection Integration**: Any pre-existing Collections in Plex and Default Hubs (Recently Added etc) can be managed alongside Agregarr Collections
- **Collection Statistics**: Dashboard showing Most Popular Collections (from Tautulli), and recently added Missing Items
- **Poster Templates**: Create your own Poster Templates which can be dynamically filled with content per-collection, including IMDb, Rotten Tomatoes, **AniList and MyAnimeList** ratings
- **Preview Collections**: Preview the collection and its matching/missing items, and add them individually via Radarr/Sonarr or Overseerr, or add items to the global exclusions list.

<img width="1902" height="983" alt="agregarr-promo" src="https://github.com/user-attachments/assets/1b744502-30ce-4988-93fc-4588e1207e69" />

## Fork Enhancements (Anime)

This fork extends upstream Agregarr with anime-focused capabilities, primarily a much more capable AniList Custom URL handler and anime ratings in poster overlays.

### AniList Custom URLs

Set Collection Type to **AniList**, Sub-Type to **Custom List**, and paste any of the URL forms below. Set **Item Order** to **"Default order (as provided by source)"** to preserve the order described here.

| URL form | What it builds |
|---|---|
| `https://anilist.co/search/anime?genres=Action&sort=POPULARITY_DESC` | Genre search. Sort is honoured; if no `sort=` is given it defaults to `POPULARITY_DESC` (matching the AniList website default). |
| `https://anilist.co/search/anime?year=2026&season=SPRING&sort=POPULARITY_DESC` | Seasonal search. `year`/`season`/`seasonYear` all work correctly. |
| `https://anilist.co/search/anime?genres=Anti-Hero` | Tags work too. Values that aren't one of AniList's 19 genres are auto-routed to the tag filter, so genres and tags can both be passed via `genres=`. |
| `https://anilist.co/search/anime?tags=Anti-Hero` (or `?genres=Anti-Hero`) | Tag-based search. Defaults to a **60% tag-relevance floor** so weakly-tagged shows are excluded. Override with `?minimumTagRank=80` (stricter) or `?minimumTagRank=0` (off). |
| `https://anilist.co/search/anime?sourceCountry=KR` | Filters by **source material** country, not production country — catches Korean manhwa adaptations (Tower of God, God of High School, Noblesse) that AniList lists as `JP`. Comma-separate for multiple, e.g. `sourceCountry=KR,CN`. Combines with other filters. |
| `https://anilist.co/anime/4654/A-Certain-Magical-Index/` | The anime **plus all its related anime** (sequels, prequels, side stories, spin-offs, alternatives, compilations). Manga adaptations, source, and character cross-refs are dropped. Sorted chronologically by air date. |
| `https://anilist.co/staff/96877/CLAMP` | Works by a **creator/author**. Defaults to the **"Original Creator"** role only (so you get CLAMP's actual works, not anime they only did character designs for). Override with `?roles=Original Creator,Original Story`. Add `&sort=START_DATE` for chronological order. |
| `https://anilist.co/studio/21/Studio-Ghibli` | Works by an **animation studio**. Defaults to the studio's **main** works only. Add `?includeSecondary=true` to include assisted works, `&sort=START_DATE` for chronological order. |
| `https://anilist.co/user/{username}/animelist/{listname}` | A user's custom list. |

Common query parameters supported on `/search/anime` URLs: `genres`, `tags`, `season`, `seasonYear`, `year`, `sort`, `format`, `status`, `source`, `country`/`countryOfOrigin`, `sourceCountry`, `licensedById`, `isLicensed`, `search`, `minimumTagRank`, year/episode/duration ranges.

**Sequel-season matching:** AniList treats each season as a separate entry (e.g. "Clevatess II"), while Plex groups all seasons under one show. Newly-airing sequels often have incomplete mapping data (no TVDB/TMDB ID yet), which would normally prevent them matching your library. This fork resolves such entries by following the AniList prequel chain to an earlier season that does have IDs — so a season 2 currently airing still gets matched to the show already in your Plex library.

### Anime Ratings in Poster Overlays

Two new overlay variables and matching preset templates: **AniList Score** and **MyAnimeList Score**. Both are normalised to a /10 scale rounded to one decimal place (e.g. `8.3`). They appear in the overlay editor's Ratings group and can be used in conditions like any other rating field.

- Items are matched to AniList/MAL via the bundled PlexAniBridge mapping; non-anime items simply skip the badge (same behaviour as the IMDb/RT overlays).
- Reuses the **MAL Client ID** already configured under MyAnimeList Settings — no extra setup.
- For multi-season shows, the **Season 1** score is used so the number is deterministic and matches what you'd see looking the show up yourself.

## Installation

### Docker Compose

```yaml
services:
  agregarr:
    image: ghcr.io/frequencylost/agregarr:latest
    container_name: agregarr
    volumes:
      - /path/to/config:/app/config # Change /path/to/config to your actual config path
      # Linux/Mac: - /mnt/serverdata/configs/agregarr:/app/config
      # Windows:   - C:\serverdata\configs\agregarr:/app/config

      # Optional: For Coming Soon/Placeholder feature
      - /path/to/placeholder/movies:/data/movies
      - /path/to/placeholder/tv:/data/tv
      # Linux/Mac:
      # - /mnt/media/movie-placeholders:/data/movies
      # - /mnt/media/tv-placeholders:/data/tv
      # Windows:
      # - E:\media\movie-placeholders:/data/movies
      # - E:\media\tv-placeholders:/data/tv

      # And then select your root folders in Settings -> Downloads
    environment:
      - TZ=Pacific/Auckland # Set to your local timezone for accurate poster overlay release dates/countdowns - see 'TZ Identifier' column here https://en.wikipedia.org/wiki/List_of_tz_database_time_zones
    ports:
      - 7171:7171
    restart: unless-stopped
```

Further instructions for basic setup available [**here**](https://agregarr.org/docs/installation) and Placeholder media volumes [**here**](https://agregarr.org/docs/placeholder-volumes)

The application will be available at `http://localhost:7171`

> **Note**: Your volume must be set correctly for the your settings to persist. If Agregarr is reset after restart, it is because your volume is not set correctly. The Coming Soon/Placeholder feature requires media volumes to be mounted, these folders should be added to Plex, but not added to Radarr/Sonarr. Without media mounts, Agregarr can run remotely and all other features will work normally.

## License

GPL-3.0 License - see [LICENSE](LICENSE) file for details.

## Credits

Originally built off [**Overseerr**](https://github.com/sct/Overseerr)

Inspired by [Kometa](https://github.com/Kometa-Team/Kometa)

Code references for Coming Soon feature from [UMTK](https://github.com/netplexflix/Upcoming-Movies-TV-Shows-for-Kometa)

Anime ID mappings file by [PlexAniBridge](https://github.com/eliasbenb/PlexAniBridge)

A massive thanks to the developers and contributors of these projects!
