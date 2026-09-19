'use strict';

require('dotenv').config();

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const { pool, initializeDatabase } = require('./database');

// =====================================================
// CONSTANTS
// =====================================================

const PORT = process.env.PORT || 3000;
const HOST_RECONNECT_GRACE_MS = 60 * 1000;
const DEFAULT_TIMER_SECONDS = 30;
const MIN_TIMER_SECONDS = 1;
const MAX_TIMER_SECONDS = 300;
const MIN_CARD_INDEX = 0;
const MAX_CARD_INDEX = 24;
const GAME_STATE_ID = 1;

// =====================================================
// SERVER SETUP
// =====================================================

initializeDatabase();

if (process.env.MIGRATE_QUESTIONS === 'true') {
  require('./migrateQuestions');
}

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

app.use(express.json());
app.use(express.static(__dirname));
app.use(express.static(path.join(__dirname, 'public')));

// =====================================================
// GAME DATA
// =====================================================

let safetyQuestionBank = [];
let gameState = createFreshGameState();
let gameStateSaveQueue = Promise.resolve();

let timer = null;
let countdown = DEFAULT_TIMER_SECONDS;
let gamePosition = -1;

let hostSocketId = null;
let hostReconnectTimer = null;
let hostReconnectPending = false;

const pendingClaims = new Map();

// =====================================================
// GAME STATE FACTORY
// =====================================================

function createFreshGameState() {
  return {
    status: 'idle',
    currentQuestionIndex: -1,
    currentQuestion: '',
    currentAnswer: '',
    currentQuestionID: null,
    currentQuestionNumber: null,
    currentCategory: '',
    currentDifficulty: '',
    calledAnswers: [],
    askedIndices: [],
    gameOrder: [],
    selectedQuestionIds: [],
    timerSeconds: DEFAULT_TIMER_SECONDS,
    noTimer: false,
    timerEndsAt: null,
    isPaused: false,
    maxWinners: 1,
    approvedWinnersCount: 0,
    approvedWinnersList: []
  };
}

// =====================================================
// VALIDATION HELPERS
// =====================================================

function validId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function validCardIndex(index) {
  const num = Number(index);
  return Number.isInteger(num) && num >= MIN_CARD_INDEX && num <= MAX_CARD_INDEX;
}

function isHost(socket) {
  return socket.id === hostSocketId;
}

// =====================================================
// TIMER HELPERS
// =====================================================

function stopTimer() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

function getRemainingSeconds() {
  if (!gameState.timerEndsAt) {
    return countdown;
  }
  return Math.max(0, Math.ceil((Number(gameState.timerEndsAt) - Date.now()) / 1000));
}

function setTimerExpiration(seconds) {
  countdown = Math.max(0, Number(seconds) || 0);
  gameState.timerEndsAt = countdown ? Date.now() + countdown * 1000 : null;
}

function emitTimer() {
  io.emit('timerUpdate', countdown);
}

function startTimer() {
  stopTimer();
  
  timer = setInterval(async () => {
    if (gameState.isPaused || gameState.noTimer || !gameState.timerEndsAt) {
      return;
    }
    
    countdown = getRemainingSeconds();
    emitTimer();
    
    if (countdown <= 0) {
      stopTimer();
      gameState.timerEndsAt = null;
      await sendNextQuestion();
    }
  }, 250);
}

function startQuestionTimer() {
  if (gameState.noTimer) {
    countdown = 0;
    gameState.timerEndsAt = null;
    emitTimer();
    return;
  }
  
  setTimerExpiration(gameState.timerSeconds);
  emitTimer();
  startTimer();
}

function restoreCountdown() {
  if (gameState.status === 'running' && !gameState.noTimer && gameState.timerEndsAt) {
    countdown = getRemainingSeconds();
  } else if (gameState.noTimer) {
    countdown = 0;
  } else {
    countdown = Number(gameState.timerSeconds) || DEFAULT_TIMER_SECONDS;
  }
  return countdown;
}

function restoreRunningTimer() {
  if (gameState.status !== 'running' || gameState.isPaused || gameState.noTimer || !gameState.timerEndsAt) {
    return;
  }
  
  countdown = getRemainingSeconds();
  emitTimer();
  
  if (countdown > 0) {
    startTimer();
  } else {
    sendNextQuestion();
  }
}

function clearTimerAndResetCountdown() {
  stopTimer();
  countdown = DEFAULT_TIMER_SECONDS;
}

// =====================================================
// QUESTION HELPERS
// =====================================================

function questionNumber(question) {
  return safetyQuestionBank.findIndex(q => q.id === question.id) + 1;
}

function questionPayload(question) {
  return {
    number: questionNumber(question),
    id: question.id,
    category: question.category,
    difficulty: question.difficulty,
    question: question.q,
    answer: question.a
  };
}

function sendCurrentQuestion(question) {
  io.emit('cheatSheetQuestion', questionPayload(question));
}

// =====================================================
// GAME STATE HELPERS
// =====================================================

function emitGameState(repeatQuestion = false) {
  io.emit('gameState', { ...gameState, repeatQuestion });
}

function resetQuestionFields() {
  Object.assign(gameState, {
    currentQuestionIndex: -1,
    currentQuestion: '',
    currentAnswer: '',
    currentQuestionID: null,
    currentQuestionNumber: null,
    currentCategory: '',
    currentDifficulty: '',
    timerEndsAt: null
  });
}

function resetPerGameData() {
  pendingClaims.clear();
  
  Object.assign(gameState, {
    status: 'running',
    askedIndices: [],
    calledAnswers: [],
    approvedWinnersCount: 0,
    approvedWinnersList: [],
    isPaused: false
  });
  
  resetQuestionFields();
}

function winnerLimitReached() {
  return gameState.approvedWinnersCount >= gameState.maxWinners;
}

function endGame(reason) {
  stopTimer();
  
  Object.assign(gameState, {
    status: 'ended',
    timerEndsAt: null,
    isPaused: false
  });
  
  pendingClaims.clear();
  io.emit('gameEnded', { reason });
}

// =====================================================
// DATABASE: QUESTIONS
// =====================================================

async function loadQuestionsFromDatabase() {
  try {
    const result = await pool.query(`
      SELECT * FROM questions 
      ORDER BY id ASC
    `);
    
    safetyQuestionBank = result.rows.map(item => ({
      id: Number(item.id),
      category: item.category,
      difficulty: item.difficulty,
      q: item.question,
      a: item.answer
    }));
    
    console.log(`Loaded ${safetyQuestionBank.length} questions from database`);
  } catch (error) {
    console.error('DATABASE QUESTION LOAD ERROR:', error);
    throw error;
  }
}

// =====================================================
// DATABASE: GAME STATE
// =====================================================

async function ensureGameStateTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS game_state (
      id INTEGER PRIMARY KEY,
      state JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  console.log('GAME STATE TABLE READY');
}

function saveGameState() {
  const snapshot = { ...gameState, gamePosition };
  
  gameStateSaveQueue = gameStateSaveQueue
    .catch(() => {})
    .then(async () => {
      try {
        await pool.query(`
          INSERT INTO game_state (id, state, updated_at)
          VALUES ($1, $2::jsonb, NOW())
          ON CONFLICT (id) DO UPDATE SET
            state = EXCLUDED.state,
            updated_at = NOW()
        `, [GAME_STATE_ID, JSON.stringify(snapshot)]);
        
        console.log('GAME STATE SAVED:', snapshot.status, 'position:', snapshot.gamePosition);
      } catch (error) {
        console.error('SAVE GAME STATE ERROR:', error);
      }
    });
  
  return gameStateSaveQueue;
}

async function loadSavedGameState() {
  try {
    const result = await pool.query(`
      SELECT state, updated_at 
      FROM game_state 
      WHERE id = $1
    `, [GAME_STATE_ID]);
    
    if (!result.rowCount) {
      console.log('NO SAVED GAME STATE FOUND');
      return false;
    }
    
    const saved = result.rows[0].state;
    
    if (!saved?.status || saved.status === 'idle') {
      console.log('SAVED GAME STATE IS IDLE');
      return false;
    }
    
    if (!Array.isArray(saved.gameOrder)) {
      console.error('SAVED GAME HAS NO VALID GAME ORDER');
      return false;
    }
    
    const validGameOrder = saved.gameOrder.filter(index => {
      const num = Number(index);
      return Number.isInteger(num) && num >= 0 && num < safetyQuestionBank.length;
    });
    
    if (!validGameOrder.length) {
      console.error('SAVED GAME ORDER IS INVALID');
      return false;
    }
    
    gameState = { ...createFreshGameState(), ...saved, gameOrder: validGameOrder };
    gamePosition = Number.isInteger(Number(saved.gamePosition)) ? Number(saved.gamePosition) : -1;
    gamePosition = Math.max(-1, Math.min(gamePosition, gameState.gameOrder.length - 1));
    
    // Ensure arrays are valid
    ['askedIndices', 'calledAnswers', 'selectedQuestionIds', 'approvedWinnersList'].forEach(key => {
      if (!Array.isArray(gameState[key])) {
        gameState[key] = [];
      }
    });
    
    pendingClaims.clear();
    restoreCountdown();
    
    console.log('==========================================');
    console.log('SAVED GAME RESTORED');
    console.log('STATUS:', gameState.status);
    console.log('GAME POSITION:', gamePosition);
    console.log('GAME QUESTIONS:', gameState.gameOrder.length);
    console.log('CURRENT QUESTION ID:', gameState.currentQuestionID);
    console.log('COUNTDOWN:', countdown);
    console.log('WINNERS:', gameState.approvedWinnersList);
    console.log('==========================================');
    
    return true;
  } catch (error) {
    console.error('LOAD SAVED GAME STATE ERROR:', error);
    return false;
  }
}

async function clearSavedGameState() {
  try {
    await pool.query('DELETE FROM game_state WHERE id = $1', [GAME_STATE_ID]);
    console.log('PERSISTED GAME STATE CLEARED');
  } catch (error) {
    console.error('CLEAR SAVED GAME STATE ERROR:', error);
  }
}

// =====================================================
// GAME LOGIC
// =====================================================

async function resetGame(reason = 'unknown') {
  console.log('==========================================');
  console.log('RESETTING GAME:', reason);
  console.log('==========================================');
  
  clearTimerAndResetCountdown();
  pendingClaims.clear();
  
  gameState = createFreshGameState();
  gamePosition = -1;
  
  await clearSavedGameState();
  
  io.emit('gameReset');
  io.emit('gameState', gameState);
  io.emit('timerUpdate', 0);
  
  console.log('========== GAME RESET COMPLETE ==========');
}

function buildGameOrder(selectedQuestionIds = []) {
  const normalizedIds = [...new Set(
    selectedQuestionIds
      .map(Number)
      .filter(id => Number.isInteger(id) && id > 0)
  )];
  
  const selectedSet = new Set(normalizedIds);
  
  const availableIndices = normalizedIds.length === 0
    ? safetyQuestionBank.map((_, index) => index)
    : safetyQuestionBank
        .map((q, index) => selectedSet.has(q.id) ? index : null)
        .filter(index => index !== null);
  
  // Fisher-Yates shuffle
  gameState.gameOrder = [...availableIndices];
  for (let i = gameState.gameOrder.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [gameState.gameOrder[i], gameState.gameOrder[j]] = [gameState.gameOrder[j], gameState.gameOrder[i]];
  }
  
  console.log('GAME ORDER BUILT:', gameState.gameOrder.length, 'QUESTIONS');
}

async function sendNextQuestion() {
  stopTimer();
  gamePosition++;
  
  if (gamePosition >= gameState.gameOrder.length) {
    Object.assign(gameState, {
      status: 'ended',
      currentQuestion: '',
      currentAnswer: '',
      timerEndsAt: null,
      isPaused: false
    });
    
    await saveGameState();
    emitGameState();
    io.emit('gameEnded', { reason: 'questions exhausted' });
    return;
  }
  
  const index = gameState.gameOrder[gamePosition];
  const question = safetyQuestionBank[index];
  
  if (!question) {
    console.error('QUESTION NOT FOUND:', index);
    return;
  }
  
  console.log('SENDING QUESTION:', question);
  
  Object.assign(gameState, {
    currentQuestionIndex: index,
    askedIndices: [...gameState.askedIndices, index],
    currentQuestionID: question.id,
    currentQuestion: question.q,
    currentAnswer: question.a,
    currentCategory: question.category,
    currentDifficulty: question.difficulty,
    currentQuestionNumber: questionNumber(question),
    isPaused: false
  });
  
  if (!gameState.calledAnswers.includes(question.a)) {
    gameState.calledAnswers.push(question.a);
  }
  
  sendCurrentQuestion(question);
  startQuestionTimer();
  await saveGameState();
  emitGameState();
}

// =====================================================
// HOST MANAGEMENT
// =====================================================

function cancelHostReconnectGrace() {
  if (hostReconnectTimer) {
    clearTimeout(hostReconnectTimer);
    hostReconnectTimer = null;
  }
  hostReconnectPending = false;
  console.log('HOST RECONNECTION GRACE PERIOD CANCELLED');
}

function startHostReconnectGrace(disconnectedHostSocketId) {
  if (hostReconnectTimer) {
    clearTimeout(hostReconnectTimer);
  }
  
  hostReconnectPending = true;
  console.log('HOST DISCONNECTED - 60 SECOND RECONNECTION GRACE:', disconnectedHostSocketId);
  
  hostReconnectTimer = setTimeout(async () => {
    hostReconnectTimer = null;
    
    if (!hostReconnectPending) return;
    
    hostReconnectPending = false;
    console.log('HOST RECONNECTION GRACE PERIOD EXPIRED');
    
    await resetGame('host reconnection grace period expired');
    hostSocketId = null;
    console.log('HOST SLOT RELEASED AFTER 60 SECOND GRACE PERIOD');
  }, HOST_RECONNECT_GRACE_MS);
}

function registerHost(socket) {
  if (hostReconnectPending) {
    cancelHostReconnectGrace();
    hostSocketId = socket.id;
    console.log('HOST RECONNECTED:', hostSocketId);
    socket.emit('hostRegistered');
    socket.emit('gameState', gameState);
    restoreRunningTimer();
    return;
  }
  
  if (!hostSocketId) {
    hostSocketId = socket.id;
    console.log('HOST REGISTERED:', hostSocketId);
    socket.emit('hostRegistered');
    socket.emit('gameState', gameState);
    restoreRunningTimer();
    return;
  }
  
  if (hostSocketId !== socket.id) {
    console.log('NEW HOST TAKING OVER:', socket.id);
    console.log('OLD HOST:', hostSocketId);
    cancelHostReconnectGrace();
    hostSocketId = socket.id;
    socket.emit('hostRegistered');
    socket.emit('gameState', gameState);
    return;
  }
  
  socket.emit('hostRegistered');
  socket.emit('gameState', gameState);
}

// =====================================================
// SETTINGS NORMALIZATION
// =====================================================

function normalizeTimerSettings(data) {
  const noTimer = data?.noTimer === true;
  let seconds = Number(data?.seconds);
  
  if (noTimer) {
    seconds = 0;
  } else if (!Number.isFinite(seconds) || seconds < MIN_TIMER_SECONDS) {
    seconds = DEFAULT_TIMER_SECONDS;
  }
  
  return { seconds, noTimer };
}

function normalizeWinnerLimit(value) {
  const maxWinners = Number(value);
  return Number.isInteger(maxWinners) && maxWinners >= 1 ? maxWinners : 1;
}

// =====================================================
// PLAYER HELPERS
// =====================================================

function sendPlayerQuestionHistory(socket) {
  gameState.askedIndices.forEach(index => {
    const question = safetyQuestionBank[index];
    if (question) {
      socket.emit('cheatSheetQuestion', questionPayload(question));
    }
  });
}

// =====================================================
// PAGE ROUTES
// =====================================================

const pages = {
  '/': 'index.html',
  '/host.html': 'host.html',
  '/player.html': 'player.html',
  '/display.html': 'display.html',
  '/questionManager.html': 'questionManager.html',
  '/cheatsheet.html': 'cheatsheet.html',
  '/answerkey.html': 'answerkey.html'
};

Object.entries(pages).forEach(([route, file]) => {
  app.get(route, (req, res) => {
    res.sendFile(path.join(__dirname, file));
  });
});

// =====================================================
// API: QUESTIONS
// =====================================================

app.get('/api/questions', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM questions ORDER BY id ASC');
    res.json(result.rows);
  } catch (error) {
    console.error('LOAD QUESTIONS ERROR:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/questions/add', async (req, res) => {
  const { q, a, category, difficulty } = req.body;
  
  if (!q || !a) {
    return res.status(400).json({ success: false, error: 'Question and answer required' });
  }
  
  try {
    const result = await pool.query('SELECT MAX(id) AS maxid FROM questions');
    const nextID = Number(result.rows[0].maxid || 0) + 1;
    
    await pool.query(`
      INSERT INTO questions (id, category, difficulty, question, answer)
      VALUES ($1, $2, $3, $4, $5)
    `, [
      nextID,
      category || 'General',
      difficulty || 'Medium',
      q,
      a
    ]);
    
    console.log('QUESTION ADDED:', nextID);
    res.json({ success: true, id: nextID });
  } catch (error) {
    console.error('ADD QUESTION ERROR:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete('/api/questions/:id', async (req, res) => {
  const id = validId(req.params.id);
  
  if (!id) {
    return res.status(400).json({ success: false, error: 'Invalid question ID' });
  }
  
  try {
    const result = await pool.query('DELETE FROM questions WHERE id = $1', [id]);
    
    if (!result.rowCount) {
      return res.status(404).json({ success: false, error: 'Question not found' });
    }
    
    console.log('QUESTION REMOVED:', id);
    res.json({ success: true });
  } catch (error) {
    console.error('DELETE ERROR:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// =====================================================
// SOCKET HANDLERS
// =====================================================

io.on('connection', socket => {
  console.log('CONNECTED:', socket.id);
  
  socket.emit('gameState', gameState);
  sendPlayerQuestionHistory(socket);
  
  // -----------------------------------------------
  // Host Registration
  // -----------------------------------------------
  socket.on('registerHost', () => {
    console.log('HOST REGISTER REQUEST:', socket.id);
    registerHost(socket);
  });
  
  // -----------------------------------------------
  // Settings
  // -----------------------------------------------
  socket.on('setTimerSettings', async data => {
    if (!isHost(socket) || !data) return;
    
    const settings = normalizeTimerSettings(data);
    gameState.timerSeconds = settings.seconds;
    gameState.noTimer = settings.noTimer;
    
    console.log('TIMER SETTINGS:', settings);
    await saveGameState();
    emitGameState();
  });
  
  socket.on('setWinnerSettings', async data => {
    if (!isHost(socket) || !data) return;
    
    gameState.maxWinners = normalizeWinnerLimit(data.maxWinners);
    console.log('MAX WINNERS:', gameState.maxWinners);
    
    await saveGameState();
    emitGameState();
  });
  
  // -----------------------------------------------
  // Game Control
  // -----------------------------------------------
  socket.on('hostStart', async data => {
    if (!isHost(socket)) {
      console.warn('HOST START REJECTED:', socket.id);
      return;
    }
    
    if (gameState.status === 'running') return;
    
    try {
      await loadQuestionsFromDatabase();
      
      if (!safetyQuestionBank.length) {
        socket.emit('gameStartError', { error: 'There are no questions in the database.' });
        return;
      }
      
      const availableIds = new Set(safetyQuestionBank.map(q => q.id));
      
      const selectedQuestionIds = [...new Set(
        Array.isArray(data?.selectedQuestionIds)
          ? data.selectedQuestionIds
              .map(Number)
              .filter(id => Number.isInteger(id) && id > 0 && availableIds.has(id))
          : []
      )];
      
      gameState.selectedQuestionIds = [...selectedQuestionIds];
      resetPerGameData();
      buildGameOrder(gameState.selectedQuestionIds);
      
      if (!gameState.gameOrder.length) {
        gameState.status = 'idle';
        socket.emit('gameStartError', { error: 'None of the selected questions exist in the database.' });
        return;
      }
      
      gamePosition = -1;
      
      console.log('==========================================');
      console.log('GAME STARTED');
      console.log('SELECTED IDS:', gameState.selectedQuestionIds);
      console.log('QUESTIONS IN GAME:', gameState.gameOrder.length);
      console.log('==========================================');
      
      await saveGameState();
      await sendNextQuestion();
    } catch (error) {
      console.error('START GAME ERROR:', error);
      gameState.status = 'idle';
      socket.emit('gameStartError', { error: 'Unable to start game.' });
    }
  });
  
  socket.on('hostNext', async () => {
    if (!isHost(socket) || gameState.status !== 'running') return;
    await sendNextQuestion();
  });
  
  socket.on('hostPrevious', async () => {
    if (!isHost(socket) || gameState.status !== 'running' || gamePosition <= 0) return;
    
    stopTimer();
    gamePosition--;
    
    const question = safetyQuestionBank[gameState.gameOrder[gamePosition]];
    if (!question) return;
    
    Object.assign(gameState, {
      currentQuestionIndex: gameState.gameOrder[gamePosition],
      currentQuestionID: question.id,
      currentQuestion: question.q,
      currentAnswer: question.a,
      currentCategory: question.category,
      currentDifficulty: question.difficulty,
      currentQuestionNumber: questionNumber(question),
      isPaused: false
    });
    
    startQuestionTimer();
    await saveGameState();
    sendCurrentQuestion(question);
    emitGameState();
  });
  
  socket.on('hostRepeat', () => {
    if (!isHost(socket) || gameState.status !== 'running') return;
    emitGameState(true);
  });
  
  // -----------------------------------------------
  // Pause/Resume
  // -----------------------------------------------
  socket.on('togglePausePlay', async () => {
    if (!isHost(socket) || gameState.status !== 'running') return;
    
    if (!gameState.isPaused) {
      gameState.isPaused = true;
      stopTimer();
      
      if (!gameState.noTimer && gameState.timerEndsAt) {
        countdown = getRemainingSeconds();
      }
      gameState.timerEndsAt = null;
      
      console.log('PAUSE: true, remaining:', countdown);
    } else {
      gameState.isPaused = false;
      
      if (!gameState.noTimer) {
        countdown = Math.max(countdown, 1);
        setTimerExpiration(countdown);
        startTimer();
      }
      
      console.log('PAUSE: false, remaining:', countdown);
    }
    
    await saveGameState();
    emitGameState();
    emitTimer();
  });
  
  // -----------------------------------------------
  // Reset
  // -----------------------------------------------
  socket.on('hostReset', async () => {
    if (!isHost(socket)) return;
    console.log('HOST RESET BUTTON:', socket.id);
    await resetGame('host reset button');
  });
  
  socket.on('resetGame', async () => {
    if (!isHost(socket)) return;
    await resetGame('legacy resetGame event');
  });
  
  // -----------------------------------------------
  // Host Disconnection
  // -----------------------------------------------
  socket.on('hostLeftGame', () => {
    if (!isHost(socket)) return;
    console.log('========== HOST LEFT GAME ==========');
    startHostReconnectGrace(socket.id);
  });
  
  // -----------------------------------------------
  // Win Claims (Digital)
  // -----------------------------------------------
  socket.on('claimWin', data => {
    if (!data || !gameState.status === 'running' || winnerLimitReached()) return;
    
    const cardId = validId(data.cardId);
    if (!cardId) return;
    
    const claim = {
      cardId,
      markedIndices: Array.isArray(data.markedIndices) ? [...data.markedIndices] : [],
      winningPattern: Array.isArray(data.winningPattern) ? [...data.winningPattern] : [],
      timestamp: data.timestamp || Date.now(),
      playerSocketId: socket.id
    };
    
    pendingClaims.set(cardId, claim);
    
    io.emit('winRequested', {
      cardId: claim.cardId,
      markedIndices: claim.markedIndices,
      winningPattern: claim.winningPattern,
      timestamp: claim.timestamp
    });
  });
  
  socket.on('approveWin', async cardId => {
    if (!isHost(socket)) return;
    
    const id = validId(cardId);
    if (!id) return;
    
    const claim = pendingClaims.get(id);
    if (!claim) return;
    
    if (gameState.approvedWinnersList.includes(id) || winnerLimitReached()) {
      pendingClaims.delete(id);
      return;
    }
    
    pendingClaims.delete(id);
    gameState.approvedWinnersList.push(id);
    gameState.approvedWinnersCount++;
    
    io.emit('winApproved', { cardId: id });
    
    if (winnerLimitReached()) {
      endGame('winner limit reached');
    }
    
    await saveGameState();
    emitGameState();
  });
  
  socket.on('rejectWin', cardId => {
    if (!isHost(socket)) return;
    
    const id = validId(cardId);
    if (!id) return;
    
    const claim = pendingClaims.get(id);
    pendingClaims.delete(id);
    
    io.emit('winRejected', {
      cardId: id,
      winningPattern: Array.isArray(claim?.winningPattern) ? [...claim.winningPattern] : []
    });
  });
  
  // -----------------------------------------------
  // Win Claims (Physical)
  // -----------------------------------------------
  socket.on('approvePhysicalWin', async data => {
    if (!isHost(socket) || !data) return;
    
    const id = validId(data.cardId);
    if (!id || gameState.approvedWinnersList.includes(id) || winnerLimitReached()) return;
    
    gameState.approvedWinnersList.push(id);
    gameState.approvedWinnersCount++;
    
    io.emit('physicalWinApproved', {
      cardId: id,
      winnerCount: gameState.approvedWinnersCount
    });
    
    if (winnerLimitReached()) {
      endGame('winner limit reached');
    }
    
    await saveGameState();
    emitGameState();
  });
  
  socket.on('rejectPhysicalWin', data => {
    if (!isHost(socket) || !data) return;
    
    const cardId = validId(data.cardId);
    if (!cardId) return;
    
    io.emit('physicalWinRejected', { cardId });
  });
  
  // -----------------------------------------------
  // Player Card
  // -----------------------------------------------
  socket.on('loadCard', cardId => {
    const id = validId(cardId);
    if (!id) return;
    socket.emit('cardLoaded', { cardId: id });
  });
  
  socket.on('markCard', data => {
    if (!data) return;
    
    const cardId = validId(data.id);
    const index = Number(data.index);
    const marked = data.marked === true;
    
    if (!cardId || !validCardIndex(index)) return;
    
    console.log('CARD MARK:', { cardId, index, marked, socketId: socket.id });
  });
  
  // -----------------------------------------------
  // State Sync
  // -----------------------------------------------
  socket.on('requestGameStateSyncFallback', () => {
    socket.emit('gameState', gameState);
  });
  
  // -----------------------------------------------
  // Disconnect
  // -----------------------------------------------
  socket.on('disconnect', () => {
    console.log('DISCONNECTED:', socket.id);
    
    // Remove claims belonging to this socket
    for (const [cardId, claim] of pendingClaims) {
      if (claim.playerSocketId === socket.id) {
        pendingClaims.delete(cardId);
      }
    }
    
    // Host disconnect
    if (socket.id === hostSocketId) {
      console.log('========== HOST CLOSED/DISCONNECTED ==========');
      startHostReconnectGrace(socket.id);
    }
  });
});

// =====================================================
// SERVER STARTUP
// =====================================================

async function startServer() {
  try {
    await ensureGameStateTable();
    await loadQuestionsFromDatabase();
    await loadSavedGameState();
    
    server.listen(PORT, '0.0.0.0', () => {
      console.log(`Safety Bingo running on port ${PORT}`);
      
      if (gameState.status !== 'running') return;
      
      console.log('==========================================');
      console.log('RECOVERED GAME IS ACTIVE');
      console.log('POSITION:', gamePosition);
      console.log('QUESTION:', gameState.currentQuestionID);
      console.log('==========================================');
      
      if (gameState.isPaused) {
        console.log('RECOVERED GAME IS PAUSED');
        emitTimer();
        return;
      }
      
      if (gameState.noTimer) {
        countdown = 0;
        emitTimer();
        return;
      }
      
      if (gameState.timerEndsAt) {
        countdown = getRemainingSeconds();
        console.log('RECOVERED TIMER:', countdown);
        
        if (countdown <= 0) {
          console.log('RECOVERED TIMER ALREADY EXPIRED');
          sendNextQuestion();
        } else {
          emitTimer();
          startTimer();
        }
      }
    });
  } catch (error) {
    console.error('SERVER STARTUP FAILED:', error);
    process.exit(1);
  }
}

startServer();
