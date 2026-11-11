import { decryptDesEcb } from './desEcb.js';

/**
 * Ensures audio URLs are HTTPS and properly formatted
 */
function sanitizeAudioUrl(url) {
  if (!url || typeof url !== 'string') return '';
  let clean = url.trim();
  // Force https:// on any returned http://aac.saavncdn.com or http audio link
  if (clean.startsWith('http://')) {
    clean = clean.replace(/^http:\/\//i, 'https://');
  }
  return clean;
}

/**
 * Extracts a valid stream URL from all known JioSaavn and mirror API formats.
 * Always returns a valid https:// audio link (preferring 320kbps, falling back to 160kbps or 96kbps).
 * 
 * @param {Object} song - The song or track object from any API format.
 * @returns {string} A valid https:// stream URL or empty string.
 */
export function getAudioStreamUrl(song) {
  if (!song || typeof song !== 'object') return '';

  let candidateUrl = '';

  // 1. If song.downloadUrl is an array: check 320kbps -> 160kbps -> 96kbps -> last items
  if (Array.isArray(song.downloadUrl) && song.downloadUrl.length > 0) {
    const q320 = song.downloadUrl.find(u => u.quality === '320kbps' || u.bitrate === '320' || u.quality === '320');
    const q160 = song.downloadUrl.find(u => u.quality === '160kbps' || u.bitrate === '160' || u.quality === '160');
    const q96 = song.downloadUrl.find(u => u.quality === '96kbps' || u.bitrate === '96' || u.quality === '96');
    const lastItem = song.downloadUrl[song.downloadUrl.length - 1];
    const firstItem = song.downloadUrl[0];

    const chosen = q320 || q160 || q96 || lastItem || firstItem;
    candidateUrl = chosen?.url || chosen?.link || '';
  } 
  // If song.downloadUrl is a string: use it directly
  else if (typeof song.downloadUrl === 'string' && song.downloadUrl.trim()) {
    candidateUrl = song.downloadUrl.trim();
  }

  // 2. Also check song.media_url || song.audioUrl || song.url || song.streamUrl
  if (!candidateUrl) {
    candidateUrl = song.media_url || 
                   song.audioUrl || 
                   song.url || 
                   song.streamUrl || 
                   '';
  }

  // 3. If only encrypted_media_url is present, decrypt using JioSaavn's DES-ECB key (38346591)
  const encrypted = song.encrypted_media_url || song.more_info?.encrypted_media_url;
  if (!candidateUrl && encrypted) {
    try {
      const decrypted = decryptDesEcb(encrypted);
      if (decrypted) {
        // Upgrade _96.mp4 to _320.mp4 and http:// to https://
        candidateUrl = decrypted.replace(/_96\.(mp4|m4a)$/i, '_320.$1');
      }
    } catch (e) {
      console.warn('[getAudioStreamUrl] Failed to decrypt encrypted_media_url:', e);
    }
  }

  // 4. Fallback to song.preview if still empty (excluding non-audio preview placeholders)
  if (!candidateUrl && song.preview && typeof song.preview === 'string') {
    candidateUrl = song.preview.trim();
  }

  return sanitizeAudioUrl(candidateUrl);
}
