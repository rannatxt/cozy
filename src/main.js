import './style.css';
import Game from './game.js';
import { submitScore, getTopScores } from './api.js';

// Screens
const screens = {
  welcome: document.getElementById('screen-welcome'),
  game: document.getElementById('screen-game'),
  gameover: document.getElementById('screen-gameover'),
  dashboard: document.getElementById('screen-dashboard'),
};

function showScreen(screenKey) {
  Object.keys(screens).forEach((key) => {
    if (key === screenKey) {
      screens[key].classList.add('active');
    } else {
      screens[key].classList.remove('active');
    }
  });
}

// Elements
const btnStart = document.getElementById('btn-start');
const btnDashboard = document.getElementById('btn-dashboard');
const btnBackHome = document.getElementById('btn-back-home');
const btnRestart = document.getElementById('btn-restart');
const btnGameoverDashboard = document.getElementById('btn-gameover-dashboard');
const btnPlayFromDash = document.getElementById('btn-play-from-dash');
const canvas = document.getElementById('game-canvas');
const hudScoreValue = document.getElementById('hud-score-value');
const hudBestValue = document.getElementById('hud-best-value');
const gameStartOverlay = document.getElementById('game-start-overlay');
const gameoverScore = document.getElementById('gameover-score');
const gameoverRank = document.getElementById('gameover-rank');
const scoreForm = document.getElementById('score-form');
const playerNameInput = document.getElementById('player-name');
const btnSubmitScore = document.getElementById('btn-submit-score');
const submitStatus = document.getElementById('submit-status');

// Power-up elements
const hudPowerup = document.getElementById('hud-powerup');
const powerupProgressFill = document.getElementById('powerup-progress-fill');

// Welcome cup and skin selectors
const welcomeCupPreview = document.getElementById('welcome-cup-preview');
const skinButtons = document.querySelectorAll('.skin-btn');

// Leaderboard / Dashboard elements
const leaderboardTableContainer = document.getElementById('leaderboard-table-container');
const leaderboardBody = document.getElementById('leaderboard-body');
const leaderboardLoading = document.getElementById('leaderboard-loading');
const leaderboardEmpty = document.getElementById('leaderboard-empty');
const leaderboardError = document.getElementById('leaderboard-error');
const pagination = document.getElementById('pagination');
const btnPrevPage = document.getElementById('btn-prev-page');
const btnNextPage = document.getElementById('btn-next-page');
const pageInfo = document.getElementById('page-info');

// Game init
const game = new Game(canvas);
let finalScore = 0;
let currentPage = 1;
let totalPages = 1;
let selectedSkin = 'classic';

// HUD initialization
hudBestValue.textContent = game.bestScore;

// Listeners / Handlers
game.onScoreUpdate = (score) => {
  hudScoreValue.textContent = score;
};

// Powerup status HUD
game.onPowerupChange = (active, progressPercent) => {
  if (active) {
    hudPowerup.style.display = 'flex';
    powerupProgressFill.style.width = `${progressPercent * 100}%`;
  } else {
    hudPowerup.style.display = 'none';
  }
};

// Skin selection wiring
skinButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    // Remove active state
    skinButtons.forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');

    // Get selected skin name
    selectedSkin = btn.getAttribute('data-skin');
    game.setSkin(selectedSkin);

    // Update welcome screen visual preview skin classes
    welcomeCupPreview.className = 'welcome-cup';
    if (selectedSkin !== 'classic') {
      welcomeCupPreview.classList.add(`${selectedSkin}-skin`);
    }
  });
});

// Funny ranks based on score
function getCoffeeRank(score) {
  if (score < 40) return 'Spilled Latte 🥛';
  if (score < 90) return 'Decaf Decent ☕';
  if (score < 180) return 'Matcha Apprentice 🍵';
  if (score < 300) return 'Espresso Master ⚡';
  return 'Matcha Deity 👑';
}

game.onGameOver = (score) => {
  finalScore = score;
  if (gameoverScore) {
    gameoverScore.textContent = score;
  }
  if (gameoverRank) {
    gameoverRank.textContent = getCoffeeRank(score);
  }
  
  // Update local best score on HUD immediately
  hudBestValue.textContent = game.bestScore;

  // Set up score form
  playerNameInput.value = localStorage.getItem('ag_player_name') || '';
  btnSubmitScore.disabled = false;
  btnSubmitScore.textContent = 'Submit Run';
  submitStatus.textContent = '';
  submitStatus.className = 'submit-status';
  scoreForm.style.display = 'flex';

  showScreen('gameover');
};

function triggerStart() {
  showScreen('game');
  gameStartOverlay.style.display = 'flex';
  hudScoreValue.textContent = '0';
  game.setSkin(selectedSkin);
  game.start();
}

function handleInput() {
  if (screens.game.classList.contains('active')) {
    if (!game.started) {
      gameStartOverlay.style.display = 'none';
      game.beginPlay();
    } else {
      game.flipGravity();
    }
  }
}

// Action button wiring
btnStart.addEventListener('click', triggerStart);
btnRestart.addEventListener('click', triggerStart);
btnPlayFromDash.addEventListener('click', triggerStart);

btnDashboard.addEventListener('click', () => {
  loadLeaderboard(1);
  showScreen('dashboard');
});

btnGameoverDashboard.addEventListener('click', () => {
  loadLeaderboard(1);
  showScreen('dashboard');
});

btnBackHome.addEventListener('click', () => {
  showScreen('welcome');
});

// Gravity flip actions
window.addEventListener('keydown', (e) => {
  if (e.code === 'Space') {
    e.preventDefault();
    handleInput();
  }
});
canvas.addEventListener('touchstart', (e) => {
  e.preventDefault();
  handleInput();
});
canvas.addEventListener('mousedown', (e) => {
  handleInput();
});

// Score Form submission
scoreForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = playerNameInput.value.trim();
  if (!name) return;

  btnSubmitScore.disabled = true;
  btnSubmitScore.textContent = 'Saving...';
  submitStatus.textContent = 'Submitting score...';
  submitStatus.className = 'submit-status';

  // Save name for convenience next time
  localStorage.setItem('ag_player_name', name);

  const result = await submitScore(name, finalScore);
  if (result.success) {
    submitStatus.textContent = result.local ? 'Saved locally (offline mode)' : 'Score submitted successfully!';
    submitStatus.className = 'submit-status';
    scoreForm.style.display = 'none';
  } else {
    submitStatus.textContent = 'Failed to submit online. Saved locally.';
    submitStatus.className = 'submit-status error';
    scoreForm.style.display = 'none';
  }
});

// Dashboard Pagination
async function loadLeaderboard(page) {
  currentPage = page;
  leaderboardLoading.style.display = 'flex';
  leaderboardTableContainer.style.display = 'none';
  leaderboardEmpty.style.display = 'none';
  leaderboardError.style.display = 'none';
  pagination.style.display = 'none';

  const res = await getTopScores(page);
  leaderboardLoading.style.display = 'none';

  if (!res.success) {
    leaderboardError.style.display = 'flex';
    return;
  }

  if (res.local) {
    leaderboardError.style.display = 'flex';
  }

  if (!res.scores || res.scores.length === 0) {
    leaderboardEmpty.style.display = 'flex';
    return;
  }

  leaderboardBody.innerHTML = '';
  res.scores.forEach((item, index) => {
    const rank = (page - 1) * 10 + index + 1;
    let badgeClass = 'badge-normal';
    if (rank === 1) badgeClass = 'badge-gold';
    else if (rank === 2) badgeClass = 'badge-silver';
    else if (rank === 3) badgeClass = 'badge-bronze';

    const row = document.createElement('tr');
    
    // Rank
    const rankTd = document.createElement('td');
    const rankBadge = document.createElement('span');
    rankBadge.className = `rank-badge ${badgeClass}`;
    rankBadge.textContent = rank;
    rankTd.appendChild(rankBadge);
    row.appendChild(rankTd);

    // Player name
    const nameTd = document.createElement('td');
    nameTd.textContent = item.player_name || 'Anonymous';
    row.appendChild(nameTd);

    // Score (saved amount)
    const scoreTd = document.createElement('td');
    scoreTd.style.textAlign = 'right';
    scoreTd.innerHTML = `<strong>${item.score}</strong> <span style="font-size: 0.75rem; opacity: 0.6;">ml</span>`;
    row.appendChild(scoreTd);

    leaderboardBody.appendChild(row);
  });

  leaderboardTableContainer.style.display = 'block';

  // Handle pagination UI
  totalPages = res.totalPages || 1;
  if (totalPages > 1) {
    pagination.style.display = 'flex';
    pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;
    btnPrevPage.disabled = currentPage === 1;
    btnNextPage.disabled = currentPage === totalPages;
  }
}

btnPrevPage.addEventListener('click', () => {
  if (currentPage > 1) {
    loadLeaderboard(currentPage - 1);
  }
});

btnNextPage.addEventListener('click', () => {
  if (currentPage < totalPages) {
    loadLeaderboard(currentPage + 1);
  }
});
