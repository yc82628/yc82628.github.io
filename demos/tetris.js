/* ==========================================================================
   Tetris: a browser port of my Pygame Tetris (Tetris repo, Tetris/*.py).

   Same rules and numbers as the original:
   - 10 x 20 field of 30 px tiles, window 1.7x the field width (settings.py)
   - pieces fall one row every 300 ms; holding ↓ switches to 15 ms until landing
   - ← → move, ↑ rotates 90° around the piece's first block (tetromino.py)
   - 1/2/3/4 lines = 100/300/700/1500 points (tetris.py)
   - cleared blocks float up and spin before disappearing
   - game over when a new piece can't move: the game restarts

   Changed for the web: blocks are drawn in code using the colours of my
   sprites, and the title uses a free Google font, because the original font
   file says it may not be redistributed.
   ========================================================================== */

const canvas = document.querySelector('#tetris');
const ctx = canvas.getContext('2d');

// ---- settings.py ----
const TILE = 30, FIELD_W = 10, FIELD_H = 20;
const WIN_W = FIELD_W * TILE * 1.7, WIN_H = FIELD_H * TILE;     // 510 x 600
const FIELD_COLOR = 'rgb(48, 39, 32)', BG_COLOR = 'rgb(24, 89, 117)';
const ANIM_TIME_INTERVAL = 300, FAST_ANIM_TIME_INTERVAL = 15;
const INIT_POS = { x: Math.floor(FIELD_W / 2) - 1, y: 0 };
const NEXT_POS = { x: FIELD_W * 1.3, y: FIELD_H * 0.45 };
const TETROMINOES = {
    T: [[0, 0], [-1, 0], [1, 0], [0, -1]],
    O: [[0, 0], [0, -1], [1, 0], [1, -1]],
    J: [[0, 0], [-1, 0], [0, -1], [0, -2]],
    L: [[0, 0], [1, 0], [0, -1], [0, -2]],
    I: [[0, 0], [0, 1], [0, -1], [0, -2]],
    S: [[0, 0], [-1, 0], [0, -1], [1, -1]],
    Z: [[0, 0], [1, 0], [0, -1], [-1, -1]],
};
const COLORS = ['#ff6a00', '#ffd800', '#ff0000', '#b200ff', '#0026ff', '#4cff00'];   // from assets/sprites/0-5.png
const POINTS_PER_LINES = { 0: 0, 1: 100, 2: 300, 3: 700, 4: 1500 };
const FONT = '"Bungee", "Arial Black", Impact, sans-serif';

const startBtn = document.querySelector('#tetris-start');
const resetBtn = document.querySelector('#tetris-reset');
const random = list => list[Math.floor(Math.random() * list.length)];

/* ---------- Game state ---------- */
let game;

function newTetromino() {
    const shape = random(Object.keys(TETROMINOES));
    return {
        shape,
        color: random(COLORS),
        blocks: TETROMINOES[shape].map(([x, y]) => ({ x: x + INIT_POS.x, y: y + INIT_POS.y })),
        landing: false,
    };
}

function reset() {
    game = {
        field: Array.from({ length: FIELD_H }, () => Array(FIELD_W).fill(null)),
        tetromino: newTetromino(),
        next: newTetromino(),
        speedUp: false,
        score: 0,
        fullLines: 0,
        effects: [],                 // cleared blocks floating away
        running: game ? game.running : false,
        lastTick: 0,
        gameOverUntil: 0,
        lastScore: 0,
    };
}

/* ---------- tetromino.py ---------- */
function isCollide(x, y) {
    // Same test as Block.is_collide: inside the walls, above the floor, and on an empty cell
    return !(x >= 0 && x < FIELD_W && y < FIELD_H && (y < 0 || !game.field[y][x]));
}

function move(direction) {
    const d = { left: [-1, 0], right: [1, 0], down: [0, 1] }[direction];
    const moved = game.tetromino.blocks.map(b => ({ x: b.x + d[0], y: b.y + d[1] }));
    if (!moved.some(b => isCollide(b.x, b.y))) {
        game.tetromino.blocks = moved;
    } else if (direction === 'down') {
        game.tetromino.landing = true;
    }
}

function rotate() {
    // Vector2.rotate(90) around the first block: (x, y) -> (-y, x)
    const pivot = game.tetromino.blocks[0];
    const rotated = game.tetromino.blocks.map(b => ({
        x: pivot.x - (b.y - pivot.y),
        y: pivot.y + (b.x - pivot.x),
    }));
    if (!rotated.some(b => isCollide(b.x, b.y))) game.tetromino.blocks = rotated;
}

/* ---------- tetris.py ---------- */
function checkFullLines(now) {
    // Walk up from the bottom, copying each row down; a full row is skipped (cleared)
    let row = FIELD_H - 1;
    for (let y = FIELD_H - 1; y >= 0; y--) {
        for (let x = 0; x < FIELD_W; x++) game.field[row][x] = game.field[y][x];

        if (game.field[y].filter(Boolean).length < FIELD_W) {
            row -= 1;
        } else {
            for (let x = 0; x < FIELD_W; x++) {
                game.effects.push({                         // the floating "sfx" blocks
                    x, y: row, color: game.field[row][x], born: now,
                    speed: 0.2 + Math.random() * 0.4,
                    life: (6 + Math.floor(Math.random() * 2)) * ANIM_TIME_INTERVAL,
                });
                game.field[row][x] = null;
            }
            game.fullLines += 1;
        }
    }
}

function checkLanding(now) {
    const t = game.tetromino;
    if (!t.landing) return;

    // Original: game over if the piece never moved. In Python a block still above
    // the board (y = -1) was written into the BOTTOM row (list[-1]); here that's game over too.
    if (t.blocks[0].y === INIT_POS.y || t.blocks.some(b => b.y < 0)) {
        const score = game.score;
        reset();
        game.lastScore = score;
        game.gameOverUntil = now + 1600;
        return;
    }
    game.speedUp = false;
    for (const b of t.blocks) game.field[b.y][b.x] = t.color;
    game.tetromino = game.next;
    game.next = newTetromino();
}

function tick(now) {
    checkFullLines(now);
    move('down');
    checkLanding(now);
    game.score += POINTS_PER_LINES[game.fullLines];
    game.fullLines = 0;
}

/* ---------- Drawing ---------- */
function drawBlock(px, py, color, alpha = 1, angle = 0) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(px + TILE / 2, py + TILE / 2);
    if (angle) ctx.rotate(angle);
    const s = TILE - 2, h = s / 2;
    ctx.fillStyle = color;
    ctx.fillRect(-h, -h, s, s);
    // bevel: light top-left, dark bottom-right, like the sprite tiles
    ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.fillRect(-h, -h, s, 4);
    ctx.fillRect(-h, -h, 4, s);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.fillRect(-h, h - 4, s, 4);
    ctx.fillRect(h - 4, -h, 4, s);
    ctx.restore();
}

function fitText(text, x, y, size, color) {
    // Like freetype render_to with a black background box; shrink if it wouldn't fit
    ctx.font = `${size}px ${FONT}`;
    let w = ctx.measureText(text).width;
    if (x + w > WIN_W - 4) {
        size *= (WIN_W - 4 - x) / w;
        ctx.font = `${size}px ${FONT}`;
        w = ctx.measureText(text).width;
    }
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#000';
    if (color !== '#fff') ctx.fillRect(x - 2, y - 2, w + 4, size * 1.05);
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
}

function draw(now) {
    ctx.fillStyle = BG_COLOR;
    ctx.fillRect(0, 0, WIN_W, WIN_H);
    ctx.fillStyle = FIELD_COLOR;
    ctx.fillRect(0, 0, FIELD_W * TILE, FIELD_H * TILE);

    // grid
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1;
    for (let x = 0; x < FIELD_W; x++)
        for (let y = 0; y < FIELD_H; y++) ctx.strokeRect(x * TILE + 0.5, y * TILE + 0.5, TILE, TILE);

    // landed blocks, falling piece, next piece
    game.field.forEach((row, y) => row.forEach((c, x) => c && drawBlock(x * TILE, y * TILE, c)));
    for (const b of game.tetromino.blocks) if (b.y >= 0) drawBlock(b.x * TILE, b.y * TILE, game.tetromino.color);
    for (const [x, y] of TETROMINOES[game.next.shape])
        drawBlock((x + NEXT_POS.x) * TILE, (y + NEXT_POS.y) * TILE, game.next.color);

    // cleared blocks floating up and spinning (Block.sfx_run)
    game.effects = game.effects.filter(e => now - e.born < e.life);
    for (const e of game.effects) {
        const age = (now - e.born) / (1000 / 60);           // frames since cleared
        drawBlock(e.x * TILE, (e.y - e.speed * age) * TILE, e.color, 110 / 255, (now * e.speed) * Math.PI / 180);
    }

    // Text class: colour-cycling title, labels and score
    const t = now / 1000, nSin = v => Math.round((Math.sin(v) * 0.5 + 0.5) * 255);
    fitText('TETRIS', WIN_W * 0.595, WIN_H * 0.02, TILE * 1.65, `rgb(${nSin(t * 0.5)}, ${nSin(t * 0.2)}, ${nSin(t * 0.9)})`);
    fitText('next', WIN_W * 0.65, WIN_H * 0.22, TILE * 1.4, 'orange');
    fitText('score', WIN_W * 0.64, WIN_H * 0.67, TILE * 1.4, 'orange');
    fitText(String(game.score), WIN_W * 0.64, WIN_H * 0.8, TILE * 1.8, '#fff');

    const overlay = (title, sub) => {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.fillRect(0, 0, WIN_W, WIN_H);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#fff';
        ctx.font = `34px ${FONT}`;
        ctx.fillText(title, WIN_W / 2, WIN_H / 2 - 18);
        ctx.font = `18px ${FONT}`;
        ctx.fillText(sub, WIN_W / 2, WIN_H / 2 + 22);
    };
    if (now < game.gameOverUntil) overlay('GAME OVER', `score ${game.lastScore}`);
    else if (!game.running) overlay('TETRIS', 'press start to play');
}

/* ---------- Main loop (App.run) ---------- */
function loop(now) {
    if (game.running && now >= game.gameOverUntil) {
        const interval = game.speedUp ? FAST_ANIM_TIME_INTERVAL : ANIM_TIME_INTERVAL;
        if (now - game.lastTick >= interval) {
            // Keep a steady 300 ms rhythm like Pygame's timer (don't lose the leftover ms each frame)
            game.lastTick = now - game.lastTick > interval * 2 ? now : game.lastTick + interval;
            tick(now);
        }
    }
    draw(now);
    requestAnimationFrame(loop);
}

/* ---------- Controls (Tetris.control) ---------- */
const actions = {
    ArrowLeft: () => move('left'),
    ArrowRight: () => move('right'),
    ArrowUp: () => rotate(),
    ArrowDown: () => { game.speedUp = true; },
};

function setRunning(on) {
    game.running = on;
    startBtn.textContent = on ? 'Pause' : 'Start';
    if (on) {
        game.lastTick = performance.now();
        canvas.focus({ preventScroll: true });
    }
}

document.addEventListener('keydown', e => {
    if (!game.running || !actions[e.key]) return;
    e.preventDefault();            // don't scroll the page with the arrow keys
    if (e.repeat) return;          // Pygame had no key repeat: one press = one move
    actions[e.key]();
});

// On-screen buttons for phones
document.querySelectorAll('[data-key]').forEach(btn => {
    btn.addEventListener('pointerdown', e => {
        e.preventDefault();
        if (!game.running) setRunning(true);
        actions[btn.dataset.key]();
    });
});

startBtn.addEventListener('click', () => setRunning(!game.running));
resetBtn.addEventListener('click', () => { reset(); setRunning(false); });

// Pause automatically if the game is scrolled out of view
new IntersectionObserver(entries => {
    if (!entries[0].isIntersecting && game.running) setRunning(false);
}).observe(canvas);

reset();
document.fonts.load(`34px ${FONT}`).finally(() => requestAnimationFrame(loop));
