// ═══════════════════════════════════════════
// API — Leaderboard operations
// ═══════════════════════════════════════════

import supabase from './supabase.js';

const PAGE_SIZE = 10;

/**
 * Submit a score to the leaderboard
 * POST /api/scores equivalent
 */
export async function submitScore(playerName, score) {
  if (!supabase) {
    console.warn('[API] Supabase not configured — score saved locally only.');
    saveLocalScore(playerName, score);
    return { success: true, local: true };
  }

  try {
    const { data, error } = await supabase
      .from('leaderboard')
      .insert([{ player_name: playerName, score }])
      .select();

    if (error) throw error;
    saveLocalScore(playerName, score);
    return { success: true, data };
  } catch (err) {
    console.error('[API] Submit error:', err);
    saveLocalScore(playerName, score);
    return { success: false, error: err.message, local: true };
  }
}

/**
 * Get top scores (paginated)
 * GET /api/scores/top equivalent
 */
export async function getTopScores(page = 1) {
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  if (!supabase) {
    return getLocalScores(page);
  }

  try {
    const { data, error, count } = await supabase
      .from('leaderboard')
      .select('*', { count: 'exact' })
      .order('score', { ascending: false })
      .range(from, to);

    if (error) throw error;
    return {
      success: true,
      scores: data,
      total: count,
      page,
      totalPages: Math.ceil(count / PAGE_SIZE),
    };
  } catch (err) {
    console.error('[API] Fetch error:', err);
    return getLocalScores(page);
  }
}

/* ── Local fallback storage ── */

function saveLocalScore(name, score) {
  const scores = JSON.parse(localStorage.getItem('ag_scores') || '[]');
  scores.push({
    id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(),
    player_name: name,
    score,
    created_at: new Date().toISOString(),
  });
  scores.sort((a, b) => b.score - a.score);
  localStorage.setItem('ag_scores', JSON.stringify(scores.slice(0, 100)));
}

function getLocalScores(page) {
  const scores = JSON.parse(localStorage.getItem('ag_scores') || '[]');
  const from = (page - 1) * PAGE_SIZE;
  const sliced = scores.slice(from, from + PAGE_SIZE);
  return {
    success: true,
    local: true,
    scores: sliced,
    total: scores.length,
    page,
    totalPages: Math.ceil(scores.length / PAGE_SIZE) || 1,
  };
}

export { PAGE_SIZE };
