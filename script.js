/**
 * NEON TETRIS - CYBER ARCADE JAVASCRIPT
 * 1인용 네온 아케이드 테트리스 게임 로직
 */

(function () {
  'use strict';

  // ==========================================================================
  // 1. Constants & Configurations
  // ==========================================================================

  const COLS = 10;
  const ROWS = 20;
  const BLOCK_SIZE = 30; // 10 * 30 = 300px width, 20 * 30 = 600px height
  const NEXT_SIZE = 24;  // Size in next preview canvas

  // Neon Color Definitions (Bright neon core, outer border, glow color, ghost fill)
  const TETROMINO_COLORS = {
    I: {
      base: '#00f0ff',
      light: '#b3faff',
      dark: '#009bb3',
      border: '#ffffff',
      glow: 'rgba(0, 240, 255, 0.9)',
      ghostFill: 'rgba(0, 240, 255, 0.12)'
    },
    O: {
      base: '#ffe600',
      light: '#fff799',
      dark: '#b3a100',
      border: '#ffffff',
      glow: 'rgba(255, 230, 0, 0.9)',
      ghostFill: 'rgba(255, 230, 0, 0.12)'
    },
    T: {
      base: '#b026ff',
      light: '#e199ff',
      dark: '#7300b3',
      border: '#ffffff',
      glow: 'rgba(176, 38, 255, 0.9)',
      ghostFill: 'rgba(176, 38, 255, 0.12)'
    },
    S: {
      base: '#00ff66',
      light: '#99ffc2',
      dark: '#00b347',
      border: '#ffffff',
      glow: 'rgba(0, 255, 102, 0.9)',
      ghostFill: 'rgba(0, 255, 102, 0.12)'
    },
    Z: {
      base: '#ff0055',
      light: '#ff99bb',
      dark: '#b3003b',
      border: '#ffffff',
      glow: 'rgba(255, 0, 85, 0.9)',
      ghostFill: 'rgba(255, 0, 85, 0.12)'
    },
    J: {
      base: '#0066ff',
      light: '#99c2ff',
      dark: '#0044b3',
      border: '#ffffff',
      glow: 'rgba(0, 102, 255, 0.9)',
      ghostFill: 'rgba(0, 102, 255, 0.12)'
    },
    L: {
      base: '#ff8800',
      light: '#ffd199',
      dark: '#b35f00',
      border: '#ffffff',
      glow: 'rgba(255, 136, 0, 0.9)',
      ghostFill: 'rgba(255, 136, 0, 0.12)'
    }
  };

  // Tetromino Matrix Shapes
  const SHAPES = {
    I: [
      [0, 0, 0, 0],
      [1, 1, 1, 1],
      [0, 0, 0, 0],
      [0, 0, 0, 0]
    ],
    O: [
      [1, 1],
      [1, 1]
    ],
    T: [
      [0, 1, 0],
      [1, 1, 1],
      [0, 0, 0]
    ],
    S: [
      [0, 1, 1],
      [1, 1, 0],
      [0, 0, 0]
    ],
    Z: [
      [1, 1, 0],
      [0, 1, 1],
      [0, 0, 0]
    ],
    J: [
      [1, 0, 0],
      [1, 1, 1],
      [0, 0, 0]
    ],
    L: [
      [0, 0, 1],
      [1, 1, 1],
      [0, 0, 0]
    ]
  };

  // Score table by line clear count
  const LINE_SCORES = {
    1: 100,
    2: 300,
    3: 500,
    4: 800
  };

  // DAS (Delayed Auto Shift) & ARR (Auto Repeat Rate) in ms
  const DAS_DELAY = 140;
  const ARR_INTERVAL = 38;

  // ==========================================================================
  // 2. DOM Elements & Canvas Initialization
  // ==========================================================================

  const boardCanvas = document.getElementById('board-canvas');
  const nextCanvas = document.getElementById('next-canvas');
  const boardCtx = initHiDPICanvas(boardCanvas, 300, 600);
  const nextCtx = initHiDPICanvas(nextCanvas, 120, 120);

  const scoreDisplay = document.getElementById('score-display');
  const levelDisplay = document.getElementById('level-display');
  const linesDisplay = document.getElementById('lines-display');
  const finalScoreVal = document.getElementById('final-score-val');

  const btnPause = document.getElementById('btn-pause');
  const btnRestart = document.getElementById('btn-restart');
  const btnOverlayResume = document.getElementById('btn-overlay-resume');
  const btnOverlayRestart = document.getElementById('btn-overlay-restart');

  const pauseOverlay = document.getElementById('pause-overlay');
  const gameOverOverlay = document.getElementById('game-over-overlay');

  /**
   * Retina/High DPI Canvas Setup
   */
  function initHiDPICanvas(canvas, logicalWidth, logicalHeight) {
    const dpr = window.devicePixelRatio || 1;
    canvas.width = logicalWidth * dpr;
    canvas.height = logicalHeight * dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    return ctx;
  }

  // ==========================================================================
  // 3. Game State Variables
  // ==========================================================================

  let board = createBoard();
  let currentPiece = null;
  let nextPiece = null;
  let bag = [];

  let score = 0;
  let level = 1;
  let totalLines = 0;
  let dropInterval = 800; // ms

  // Game Loop & Timing
  let gameState = 'STOPPED'; // 'PLAYING' | 'PAUSED' | 'GAME_OVER'
  let animFrameId = null;
  let lastTime = 0;
  let dropCounter = 0;

  // Input & Key State
  let isSoftDropping = false;
  let dasTimeout = null;
  let arrInterval = null;
  let activeDirection = null; // 'left' | 'right' | null

  // Line Clear Animation State
  let clearingLines = [];
  let isClearing = false;
  let clearTimer = null;

  // ==========================================================================
  // 4. Board & 7-Bag Logic
  // ==========================================================================

  function createBoard() {
    return Array.from({ length: ROWS }, () => Array(COLS).fill(0));
  }

  /**
   * 7-Bag Randomizer:
   * Shuffles all 7 pieces once empty, ensuring balanced distribution
   */
  function refillBag() {
    const pieces = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'];
    // Fisher-Yates shuffle
    for (let i = pieces.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pieces[i], pieces[j]] = [pieces[j], pieces[i]];
    }
    bag = pieces;
  }

  function getNextPieceFromBag() {
    if (bag.length === 0) {
      refillBag();
    }
    const type = bag.pop();
    const matrix = SHAPES[type].map(row => [...row]);
    
    // Initial spawn coordinate
    let x = Math.floor((COLS - matrix[0].length) / 2);
    let y = 0;
    // For 'I' piece, row 1 contains the 4 blocks, spawn with row 1 at board y=0
    if (type === 'I') {
      y = -1;
    }

    return {
      type,
      matrix,
      x,
      y
    };
  }

  // ==========================================================================
  // 5. Collision & Movement
  // ==========================================================================

  function checkCollision(piece, b = board, offsetX = 0, offsetY = 0) {
    const { matrix, x, y } = piece;
    for (let r = 0; r < matrix.length; r++) {
      for (let c = 0; c < matrix[r].length; c++) {
        if (matrix[r][c] !== 0) {
          const newX = x + c + offsetX;
          const newY = y + r + offsetY;

          // Wall collision
          if (newX < 0 || newX >= COLS) return true;
          // Floor collision
          if (newY >= ROWS) return true;
          // Existing block collision (ignore if above board ceiling)
          if (newY >= 0 && b[newY][newX] !== 0) return true;
        }
      }
    }
    return false;
  }

  function moveLeft() {
    if (gameState !== 'PLAYING' || isClearing) return;
    if (!checkCollision(currentPiece, board, -1, 0)) {
      currentPiece.x--;
      render();
    }
  }

  function moveRight() {
    if (gameState !== 'PLAYING' || isClearing) return;
    if (!checkCollision(currentPiece, board, 1, 0)) {
      currentPiece.x++;
      render();
    }
  }

  /**
   * Rotate piece 90 degrees clockwise with wall kicks
   */
  function rotatePiece() {
    if (gameState !== 'PLAYING' || isClearing || !currentPiece) return;

    // Rotate matrix clockwise: transpose + reverse each row
    const originalMatrix = currentPiece.matrix;
    const rotated = originalMatrix[0].map((_, c) =>
      originalMatrix.map(row => row[c]).reverse()
    );

    // Wall kick offsets to test (in order of priority)
    const kickOffsets = [
      [0, 0],
      [-1, 0],
      [1, 0],
      [-2, 0],
      [2, 0],
      [0, -1],
      [-1, -1],
      [1, -1]
    ];

    const testPiece = { ...currentPiece, matrix: rotated };

    for (const [dx, dy] of kickOffsets) {
      if (!checkCollision(testPiece, board, dx, dy)) {
        currentPiece.matrix = rotated;
        currentPiece.x += dx;
        currentPiece.y += dy;
        render();
        return;
      }
    }
  }

  /**
   * Calculate Ghost piece (landing position preview)
   */
  function getGhostPiece() {
    if (!currentPiece) return null;
    let ghostY = currentPiece.y;
    while (!checkCollision(currentPiece, board, 0, ghostY - currentPiece.y + 1)) {
      ghostY++;
    }
    return {
      ...currentPiece,
      y: ghostY
    };
  }

  /**
   * Hard Drop: Immediately drop piece to landing position and lock
   */
  function hardDrop() {
    if (gameState !== 'PLAYING' || isClearing || !currentPiece) return;
    const ghost = getGhostPiece();
    if (ghost) {
      currentPiece.y = ghost.y;
      lockPiece();
    }
  }

  /**
   * Drop piece by one step (auto drop or soft drop)
   */
  function dropPiece() {
    if (gameState !== 'PLAYING' || isClearing || !currentPiece) return;

    if (!checkCollision(currentPiece, board, 0, 1)) {
      currentPiece.y++;
      render();
    } else {
      lockPiece();
    }
  }

  /**
   * Lock piece to the board, check line clears, and spawn next
   */
  function lockPiece() {
    const { matrix, x, y, type } = currentPiece;

    for (let r = 0; r < matrix.length; r++) {
      for (let c = 0; c < matrix[r].length; c++) {
        if (matrix[r][c] !== 0) {
          const boardY = y + r;
          const boardX = x + c;
          if (boardY >= 0 && boardY < ROWS && boardX >= 0 && boardX < COLS) {
            board[boardY][boardX] = type;
          }
        }
      }
    }

    currentPiece = null;
    checkAndClearLines();
  }

  /**
   * Find completed rows and handle neon flash clear effect
   */
  function checkAndClearLines() {
    const fullRows = [];
    for (let r = 0; r < ROWS; r++) {
      if (board[r].every(cell => cell !== 0)) {
        fullRows.push(r);
      }
    }

    if (fullRows.length > 0) {
      // Trigger neon flash effect for 140ms
      isClearing = true;
      clearingLines = fullRows;
      render();

      clearTimer = setTimeout(() => {
        // Remove lines from board
        const linesCleared = fullRows.length;
        const newBoard = board.filter((_, idx) => !fullRows.includes(idx));
        while (newBoard.length < ROWS) {
          newBoard.unshift(Array(COLS).fill(0));
        }
        board = newBoard;

        // Score Calculation using Level BEFORE line clear
        const prevLevel = level;
        const baseScore = LINE_SCORES[linesCleared] || 0;
        const earnedScore = baseScore * prevLevel;
        score += earnedScore;
        totalLines += linesCleared;

        // Level Up: 1 level per 10 accumulated lines
        level = Math.floor(totalLines / 10) + 1;

        // Drop Interval calculation:
        // Starts at 800ms, reduced by 15% per level, min 100ms
        dropInterval = Math.max(100, Math.floor(800 * Math.pow(0.85, level - 1)));

        // Update HUD
        updateHUD();

        isClearing = false;
        clearingLines = [];
        spawnNextPiece();
      }, 140);
    } else {
      spawnNextPiece();
    }
  }

  /**
   * Spawn next piece and check spawn collision for Game Over
   */
  function spawnNextPiece() {
    currentPiece = nextPiece;
    nextPiece = getNextPieceFromBag();
    renderNextPiece();

    // Check game over
    if (checkCollision(currentPiece, board, 0, 0)) {
      triggerGameOver();
      return;
    }

    dropCounter = 0;
    render();
  }

  // ==========================================================================
  // 6. Visual Rendering (Neon Effects & Canvases)
  // ==========================================================================

  /**
   * Render single neon cell with multi-layer glow and LED bevel
   */
  function drawNeonCell(ctx, px, py, size, colorInfo, isGhost = false) {
    const gap = 1.5;
    const x = px + gap;
    const y = py + gap;
    const w = size - gap * 2;
    const h = size - gap * 2;

    ctx.save();

    if (isGhost) {
      // Ghost Block: Subtle glow, transparent inside, crisp neon border
      ctx.shadowColor = colorInfo.glow;
      ctx.shadowBlur = 5;

      ctx.fillStyle = colorInfo.ghostFill;
      ctx.fillRect(x, y, w, h);

      ctx.strokeStyle = colorInfo.base;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(x, y, w, h);
    } else {
      // Solid Neon Block:
      // Layer 1: Ambient Neon Glow
      ctx.shadowColor = colorInfo.glow;
      ctx.shadowBlur = 10;

      // Layer 2: Beveled gradient interior (LED Glass look)
      const grad = ctx.createLinearGradient(x, y, x + w, y + h);
      grad.addColorStop(0, colorInfo.light);
      grad.addColorStop(0.35, colorInfo.base);
      grad.addColorStop(1, colorInfo.dark);

      ctx.fillStyle = grad;
      ctx.fillRect(x, y, w, h);

      // Layer 3: Crisp bright outer border
      ctx.strokeStyle = colorInfo.border;
      ctx.lineWidth = 1.2;
      ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);

      // Layer 4: Subtle top-left glass highlight
      ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
      ctx.fillRect(x + 2, y + 2, w - 4, 1.5);
      ctx.fillRect(x + 2, y + 3.5, 1.5, h - 6);
    }

    ctx.restore();
  }

  /**
   * Main Render Function
   */
  function render() {
    // 1. Clear background
    boardCtx.fillStyle = '#060914';
    boardCtx.fillRect(0, 0, 300, 600);

    // 2. Draw subtle grid lines (Faint cyan, 0.08 alpha)
    boardCtx.strokeStyle = 'rgba(0, 240, 255, 0.08)';
    boardCtx.lineWidth = 1;

    for (let c = 1; c < COLS; c++) {
      boardCtx.beginPath();
      boardCtx.moveTo(c * BLOCK_SIZE, 0);
      boardCtx.lineTo(c * BLOCK_SIZE, 600);
      boardCtx.stroke();
    }
    for (let r = 1; r < ROWS; r++) {
      boardCtx.beginPath();
      boardCtx.moveTo(0, r * BLOCK_SIZE);
      boardCtx.lineTo(300, r * BLOCK_SIZE);
      boardCtx.stroke();
    }

    // 3. Draw Locked Blocks on Board
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const type = board[r][c];
        if (type !== 0) {
          const color = TETROMINO_COLORS[type];
          drawNeonCell(boardCtx, c * BLOCK_SIZE, r * BLOCK_SIZE, BLOCK_SIZE, color, false);
        }
      }
    }

    // 4. Draw Line Clear Neon Flash
    if (isClearing && clearingLines.length > 0) {
      boardCtx.save();
      boardCtx.shadowColor = '#ffffff';
      boardCtx.shadowBlur = 20;
      boardCtx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      for (const rowIdx of clearingLines) {
        boardCtx.fillRect(0, rowIdx * BLOCK_SIZE, 300, BLOCK_SIZE);
      }
      boardCtx.restore();
    }

    // 5. Draw Ghost Block
    if (currentPiece && !isClearing && gameState === 'PLAYING') {
      const ghost = getGhostPiece();
      if (ghost && ghost.y !== currentPiece.y) {
        const color = TETROMINO_COLORS[ghost.type];
        for (let r = 0; r < ghost.matrix.length; r++) {
          for (let c = 0; c < ghost.matrix[r].length; c++) {
            if (ghost.matrix[r][c] !== 0) {
              const px = (ghost.x + c) * BLOCK_SIZE;
              const py = (ghost.y + r) * BLOCK_SIZE;
              if (py >= 0) {
                drawNeonCell(boardCtx, px, py, BLOCK_SIZE, color, true);
              }
            }
          }
        }
      }
    }

    // 6. Draw Current Falling Block
    if (currentPiece && !isClearing) {
      const color = TETROMINO_COLORS[currentPiece.type];
      for (let r = 0; r < currentPiece.matrix.length; r++) {
        for (let c = 0; c < currentPiece.matrix[r].length; c++) {
          if (currentPiece.matrix[r][c] !== 0) {
            const px = (currentPiece.x + c) * BLOCK_SIZE;
            const py = (currentPiece.y + r) * BLOCK_SIZE;
            if (py >= 0) {
              drawNeonCell(boardCtx, px, py, BLOCK_SIZE, color, false);
            }
          }
        }
      }
    }
  }

  /**
   * Render Next Piece in Preview Canvas
   */
  function renderNextPiece() {
    nextCtx.fillStyle = '#060914';
    nextCtx.fillRect(0, 0, 120, 120);

    if (!nextPiece) return;

    const matrix = nextPiece.matrix;
    const color = TETROMINO_COLORS[nextPiece.type];

    // Compute bounding box to center the piece
    let minR = matrix.length, maxR = -1, minC = matrix[0].length, maxC = -1;
    for (let r = 0; r < matrix.length; r++) {
      for (let c = 0; c < matrix[r].length; c++) {
        if (matrix[r][c] !== 0) {
          if (r < minR) minR = r;
          if (r > maxR) maxR = r;
          if (c < minC) minC = c;
          if (c > maxC) maxC = c;
        }
      }
    }

    const pieceWidth = (maxC - minC + 1) * NEXT_SIZE;
    const pieceHeight = (maxR - minR + 1) * NEXT_SIZE;
    const offsetX = (120 - pieceWidth) / 2 - minC * NEXT_SIZE;
    const offsetY = (120 - pieceHeight) / 2 - minR * NEXT_SIZE;

    for (let r = 0; r < matrix.length; r++) {
      for (let c = 0; c < matrix[r].length; c++) {
        if (matrix[r][c] !== 0) {
          const px = offsetX + c * NEXT_SIZE;
          const py = offsetY + r * NEXT_SIZE;
          drawNeonCell(nextCtx, px, py, NEXT_SIZE, color, false);
        }
      }
    }
  }

  /**
   * Update HUD Statistics
   */
  function updateHUD() {
    scoreDisplay.textContent = score.toLocaleString('ko-KR');
    levelDisplay.textContent = String(level).padStart(2, '0');
    linesDisplay.textContent = String(totalLines).padStart(2, '0');
  }

  // ==========================================================================
  // 7. Core Game Loop
  // ==========================================================================

  function gameLoop(time = 0) {
    if (gameState !== 'PLAYING') return;

    if (!lastTime) lastTime = time;
    const delta = time - lastTime;
    lastTime = time;

    if (!isClearing) {
      dropCounter += delta;
      // Soft drop speed: 45ms or interval / 10
      const currentDropSpeed = isSoftDropping ? Math.min(45, Math.floor(dropInterval / 10)) : dropInterval;

      if (dropCounter >= currentDropSpeed) {
        dropPiece();
        dropCounter = 0;
      }
    }

    render();
    animFrameId = requestAnimationFrame(gameLoop);
  }

  // ==========================================================================
  // 8. Game Lifecycle (Start, Pause, Resume, Restart, Game Over)
  // ==========================================================================

  function startGame() {
    stopCurrentGame();

    board = createBoard();
    bag = [];
    score = 0;
    level = 1;
    totalLines = 0;
    dropInterval = 800;

    updateHUD();
    pauseOverlay.classList.add('hidden');
    gameOverOverlay.classList.add('hidden');
    btnPause.textContent = '일시정지';

    nextPiece = getNextPieceFromBag();
    currentPiece = getNextPieceFromBag();
    renderNextPiece();

    gameState = 'PLAYING';
    lastTime = performance.now();
    dropCounter = 0;
    animFrameId = requestAnimationFrame(gameLoop);
  }

  function pauseGame() {
    if (gameState !== 'PLAYING') return;
    gameState = 'PAUSED';

    if (animFrameId) {
      cancelAnimationFrame(animFrameId);
      animFrameId = null;
    }
    stopInputRepeat();
    isSoftDropping = false;

    btnPause.textContent = '계속하기';
    pauseOverlay.classList.remove('hidden');
    render();
  }

  function resumeGame() {
    if (gameState !== 'PAUSED') return;
    gameState = 'PLAYING';

    btnPause.textContent = '일시정지';
    pauseOverlay.classList.add('hidden');

    lastTime = performance.now();
    dropCounter = 0;
    animFrameId = requestAnimationFrame(gameLoop);
  }

  function togglePause() {
    if (gameState === 'PLAYING') {
      pauseGame();
    } else if (gameState === 'PAUSED') {
      resumeGame();
    }
  }

  function triggerGameOver() {
    gameState = 'GAME_OVER';

    if (animFrameId) {
      cancelAnimationFrame(animFrameId);
      animFrameId = null;
    }
    stopInputRepeat();
    isSoftDropping = false;

    finalScoreVal.textContent = score.toLocaleString('ko-KR');
    gameOverOverlay.classList.remove('hidden');
    render();
  }

  function stopCurrentGame() {
    if (animFrameId) {
      cancelAnimationFrame(animFrameId);
      animFrameId = null;
    }
    if (clearTimer) {
      clearTimeout(clearTimer);
      clearTimer = null;
    }
    stopInputRepeat();
    isSoftDropping = false;
    isClearing = false;
    clearingLines = [];
  }

  // ==========================================================================
  // 9. Controls & DAS/ARR Keyboard Handling
  // ==========================================================================

  function startInputRepeat(direction) {
    if (activeDirection === direction) return;
    stopInputRepeat();
    activeDirection = direction;

    // First shift immediate
    if (direction === 'left') moveLeft();
    if (direction === 'right') moveRight();

    // After DAS_DELAY, shift repeatedly every ARR_INTERVAL
    dasTimeout = setTimeout(() => {
      arrInterval = setInterval(() => {
        if (activeDirection === 'left') moveLeft();
        if (activeDirection === 'right') moveRight();
      }, ARR_INTERVAL);
    }, DAS_DELAY);
  }

  function stopInputRepeat(direction = null) {
    if (direction && activeDirection !== direction) return;
    activeDirection = null;
    if (dasTimeout) {
      clearTimeout(dasTimeout);
      dasTimeout = null;
    }
    if (arrInterval) {
      clearInterval(arrInterval);
      arrInterval = null;
    }
  }

  window.addEventListener('keydown', (e) => {
    // Prevent default scroll on arrow keys and Spacebar
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
      e.preventDefault();
    }

    if (gameState !== 'PLAYING') return;

    switch (e.key) {
      case 'ArrowLeft':
        if (!e.repeat) startInputRepeat('left');
        break;

      case 'ArrowRight':
        if (!e.repeat) startInputRepeat('right');
        break;

      case 'ArrowUp':
        if (!e.repeat) rotatePiece();
        break;

      case 'ArrowDown':
        if (!isSoftDropping) {
          dropPiece();
          dropCounter = 0;
        }
        isSoftDropping = true;
        break;

      case ' ':
        if (!e.repeat) hardDrop();
        break;
    }
  });

  window.addEventListener('keyup', (e) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
      e.preventDefault();
    }

    switch (e.key) {
      case 'ArrowLeft':
        stopInputRepeat('left');
        break;

      case 'ArrowRight':
        stopInputRepeat('right');
        break;

      case 'ArrowDown':
        isSoftDropping = false;
        break;
    }
  });

  // ==========================================================================
  // 10. Auto Pause on Tab Switch / Window Blur
  // ==========================================================================

  window.addEventListener('blur', () => {
    if (gameState === 'PLAYING') {
      pauseGame();
    }
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && gameState === 'PLAYING') {
      pauseGame();
    }
  });

  // ==========================================================================
  // 11. Button Event Listeners & Boot
  // ==========================================================================

  btnPause.addEventListener('click', togglePause);
  btnOverlayResume.addEventListener('click', resumeGame);

  btnRestart.addEventListener('click', startGame);
  btnOverlayRestart.addEventListener('click', startGame);

  // Initialize and automatically start game upon loading
  startGame();

})();
