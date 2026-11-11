/**
 * @typedef {Object} PlaylistCategory
 * @property {string} id - A unique alphanumeric string identifier.
 * @property {string} category - The UI section header.
 * @property {string} subtitle - A subtle, engaging UI description.
 * @property {string} apiQuery - The EXACT, highly-optimized search string to pass into our API wrapper.
 * @property {string} [language] - Injected property indicating the language context of the playlist.
 */

/**
 * An immutable localization dictionary mapping supported languages to pre-curated playlist categories.
 * This establishes a robust, decoupled data layer for localized music discovery, bypassing the need
 * for dynamic LLM generation on high-traffic home screens.
 * 
 * @constant
 * @type {Object.<string, Omit<PlaylistCategory, 'language'>[]>}
 */
export const CURATED_PLAYLISTS = {
  malayalam: [
    {
      id: 'mal_trending_01',
      category: 'Trending Now 🔥',
      subtitle: 'Viral hits and chart-toppers from Mollywood',
      apiQuery: 'Malayalam hits'
    },
    {
      id: 'mal_classics_01',
      category: 'Timeless Classics 🌴',
      subtitle: 'Golden melodies from the 90s and 2000s',
      apiQuery: 'Malayalam classic'
    },
    {
      id: 'mal_romance_01',
      category: 'Late Night Romance 💖',
      subtitle: 'Anuragatham: Soulful romantic tracks',
      apiQuery: 'Malayalam romance'
    },
    {
      id: 'mal_bangers_01',
      category: 'High-Energy Bangers ⚡',
      subtitle: 'Adipoli beats and high-tempo tracks',
      apiQuery: 'Malayalam dance'
    }
  ],
  tamil: [
    {
      id: 'tam_trending_01',
      category: 'Trending Now 🔥',
      subtitle: 'What Kollywood is listening to right now',
      apiQuery: 'Tamil hits'
    },
    {
      id: 'tam_classics_01',
      category: 'Timeless Classics 🌴',
      subtitle: 'The everlasting magic of the masters',
      apiQuery: 'Tamil classic'
    },
    {
      id: 'tam_romance_01',
      category: 'Late Night Romance 💖',
      subtitle: 'Kaadhal notes and soothing vocals',
      apiQuery: 'Tamil love'
    },
    {
      id: 'tam_bangers_01',
      category: 'High-Energy Bangers ⚡',
      subtitle: 'Pure energy and festival beats',
      apiQuery: 'Tamil kuthu'
    }
  ],
  telugu: [
    {
      id: 'tel_trending_01',
      category: 'Trending Now 🔥',
      subtitle: 'Top chartbusters from Tollywood',
      apiQuery: 'Telugu hits'
    },
    {
      id: 'tel_classics_01',
      category: 'Timeless Classics 🌴',
      subtitle: 'Retro gold and melody classics',
      apiQuery: 'Telugu classic'
    },
    {
      id: 'tel_romance_01',
      category: 'Late Night Romance 💖',
      subtitle: 'Romantic heartbeats from Telugu cinema',
      apiQuery: 'Telugu romance'
    }
  ],
  kannada: [
    {
      id: 'kan_trending_01',
      category: 'Trending Now 🔥',
      subtitle: "Sandalwood's biggest current hits",
      apiQuery: 'Kannada hits'
    },
    {
      id: 'kan_classics_01',
      category: 'Timeless Classics 🌴',
      subtitle: 'Evergreen Sandalwood melodies',
      apiQuery: 'Kannada classic'
    },
    {
      id: 'kan_romance_01',
      category: 'Late Night Romance 💖',
      subtitle: 'Preethi: Modern romantic vibes',
      apiQuery: 'Kannada romance'
    }
  ],
  hindi: [
    {
      id: 'hin_trending_01',
      category: 'Trending Now 🔥',
      subtitle: "Bollywood's top viral chart-toppers",
      apiQuery: 'Bollywood hits'
    },
    {
      id: 'hin_classics_01',
      category: 'Timeless Classics 🌴',
      subtitle: 'The golden era of Indian cinema',
      apiQuery: 'Hindi classic'
    },
    {
      id: 'hin_romance_01',
      category: 'Late Night Romance 💖',
      subtitle: 'Ishq & Melodies for the soul',
      apiQuery: 'Hindi romantic'
    }
  ],
  english: [
    {
      id: 'eng_trending_01',
      category: 'Trending Now 🔥',
      subtitle: 'International hits trending worldwide',
      apiQuery: 'Global pop hits'
    },
    {
      id: 'eng_classics_01',
      category: 'Timeless Classics 🌴',
      subtitle: 'Timeless anthems that never age',
      apiQuery: 'Classic rock'
    },
    {
      id: 'eng_romance_01',
      category: 'Late Night Romance 💖',
      subtitle: 'Late night acoustic heartbeats',
      apiQuery: 'Acoustic pop'
    }
  ],
  punjabi: [
    {
      id: 'pun_trending_01',
      category: 'Trending Now 🔥',
      subtitle: 'Top chart-toppers and viral Punjabi hits',
      apiQuery: 'Punjabi hits'
    },
    {
      id: 'pun_classics_01',
      category: 'Timeless Classics 🌴',
      subtitle: 'Evergreen Punjabi folk and retro gold',
      apiQuery: 'Punjabi classic'
    },
    {
      id: 'pun_romance_01',
      category: 'Late Night Romance 💖',
      subtitle: 'Soulful Punjabi romantic melodies',
      apiQuery: 'Punjabi romantic'
    },
    {
      id: 'pun_bangers_01',
      category: 'High-Energy Bangers ⚡',
      subtitle: 'Bhangra beats and dancefloor anthems',
      apiQuery: 'Punjabi bhangra'
    }
  ],
  marathi: [
    {
      id: 'mar_trending_01',
      category: 'Trending Now 🔥',
      subtitle: 'Top trending Marathi tracks',
      apiQuery: 'Marathi hits'
    },
    {
      id: 'mar_classics_01',
      category: 'Timeless Classics 🌴',
      subtitle: 'Golden Marathi Natyasangeet and film melodies',
      apiQuery: 'Marathi classic'
    },
    {
      id: 'mar_romance_01',
      category: 'Late Night Romance 💖',
      subtitle: 'Soulful Marathi romantic tunes',
      apiQuery: 'Marathi romantic'
    }
  ]
};

/**
 * Evaluates the user's saved language preferences and dynamically generates
 * a robust, flattened dataset for rendering the localized Home/Dashboard view.
 * 
 * @param {string[]} selectedLanguagesArray - Array of selected language keys (e.g., ['hindi', 'english'])
 * @returns {PlaylistCategory[]} A fully deduplicated and localized array of playlist categories.
 */
export function getLocalizedPlaylists(selectedLanguagesArray) {
  if (!Array.isArray(selectedLanguagesArray) || selectedLanguagesArray.length === 0) {
    return [];
  }

  // Defensively deduplicate requested languages to prevent redundant UI groups
  const uniqueLanguages = [...new Set(selectedLanguagesArray.map(lang => lang.toLowerCase()))];
  
  const mergedPlaylists = [];

  for (const lang of uniqueLanguages) {
    const playlists = CURATED_PLAYLISTS[lang];
    if (playlists) {
      // Inject language property to track origin and map to a flat array
      const localizedPlaylists = playlists.map(playlist => ({
        ...playlist,
        language: lang
      }));
      mergedPlaylists.push(...localizedPlaylists);
    }
  }

  return mergedPlaylists;
}
