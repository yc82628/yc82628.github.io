/* ==========================================================================
   Pong: a browser port of my first Python project (Pong-Game/main.py, turtle).

   Same rules and numbers as the original:
   - 800 x 600 field, paddles at x = ±350 (20 x 100), ball 20 x 20
   - ball moves dx = 2, dy = -2 each step, bounces at y = ±290
   - a point is scored when the ball passes x = ±390, then it restarts in the middle
   - paddles move 20 per key press (W/S and ↑/↓)

   Added for the web demo: a computer opponent, start/pause, and touch controls.
   ========================================================================== */

const canvas = document.querySelector('#pong');
const ctx = canvas.getContext('2d');
const W = 800, H = 600;

const startBtn = document.querySelector('#pong-start');
const resetBtn = document.querySelector('#pong-reset');
const cpuBtn = document.querySelector('#pong-cpu');

// turtle puts (0, 0) in the centre with y pointing up; canvas puts it top-left with y down
const toX = x => x + W / 2;
const toY = y => H / 2 - y;

// The Python loop ran as fast as the computer allowed. 3 steps per screen
// refresh gives roughly the speed it had on a typical laptop.
const STEPS_PER_FRAME = 3;

const game = {
    scoreA: 0, scoreB: 0,
    paddleA: 0, paddleB: 0,           // paddle centre y
    ball: { x: 0, y: 0, dx: 2, dy: -2 },
    running: false,
    cpu: true,                        // computer plays Player B
    cpuTimer: 0,
};

function reset() {
    Object.assign(game, { scoreA: 0, scoreB: 0, paddleA: 0, paddleB: 0, cpuTimer: 0, cpuAim: undefined });
    game.ball = { x: 0, y: 0, dx: 2, dy: -2 };
    draw();
}

/* ---------- One step of the original main loop ---------- */
function step() {
    const ball = game.ball;
    ball.x += ball.dx;
    ball.y += ball.dy;

    // Border checking
    if (ball.y > 290)  { ball.y = 290;  ball.dy *= -1; }
    if (ball.y < -290) { ball.y = -290; ball.dy *= -1; }

    if (ball.x > 390)  { ball.x = 0; ball.y = 0; ball.dx *= -1; game.scoreA += 1; }
    if (ball.x < -390) { ball.x = 0; ball.y = 0; ball.dx *= -1; game.scoreB += 1; }

    // Paddle & ball collision
    if (ball.x > 340 && ball.x < 350 && ball.y < game.paddleB + 40 && ball.y > game.paddleB - 40) {
        ball.x = 340;
        ball.dx *= -1;
    }
    if (ball.x < -340 && ball.x > -350 && ball.y < game.paddleA + 40 && ball.y > game.paddleA - 40) {
        ball.x = -340;
        ball.dx *= -1;
    }
}

/* ---------- Computer opponent (web demo only) ----------
   It "presses" up/down like a player would: 20 units at a time, about
   15 presses per second. It aims at where the ball WILL arrive (bouncing
   off the walls), plus a small random error each rally so it can be beaten. */
const CPU_PRESS_EVERY = 4;   // frames between presses: lower = harder
const CPU_ERROR = 45;        // max aiming error in units: higher = easier

function predictArrivalY() {
    // Follow the ball's path to the paddle (x = 340), reflecting off y = ±290
    let { x, y, dy } = game.ball;
    const steps = (340 - x) / Math.abs(game.ball.dx);
    y += dy * steps;
    const span = 580;                                        // from -290 to 290
    let t = ((y + 290) % (2 * span) + 2 * span) % (2 * span); // fold the path back into the field
    if (t > span) t = 2 * span - t;
    return t - 290;
}

function computerMove() {
    if (!game.cpu) return;
    const ball = game.ball;

    // New rally towards the computer: pick this rally's aiming error once
    if (ball.dx > 0 && game.cpuAim === undefined) {
        game.cpuAim = predictArrivalY() + (Math.random() * 2 - 1) * CPU_ERROR;
    }
    if (ball.dx < 0) game.cpuAim = undefined;

    game.cpuTimer += 1;
    if (game.cpuTimer < CPU_PRESS_EVERY) return;
    game.cpuTimer = 0;

    // Ball coming: go to the aim point. Ball going away: drift back to the middle.
    const target = ball.dx > 0 ? game.cpuAim : 0;
    const diff = target - game.paddleB;
    if (diff > 10) game.paddleB += 20;
    else if (diff < -10) game.paddleB -= 20;
}

/* ---------- Drawing: same black screen and white squares as turtle ---------- */
function rect(cx, cy, w, h) {
    ctx.fillRect(toX(cx) - w / 2, toY(cy) - h / 2, w, h);
}

function draw() {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = '#fff';
    rect(-350, game.paddleA, 20, 100);
    rect(350, game.paddleB, 20, 100);
    rect(game.ball.x, game.ball.y, 20, 20);

    ctx.font = '24px "Courier New", Courier, monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`Player A: ${game.scoreA}  Player B: ${game.scoreB}`, W / 2, toY(260));

    if (!game.running) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = '#fff';
        ctx.font = '28px "Courier New", Courier, monospace';
        ctx.fillText('Press Start to play', W / 2, H / 2 + 10);
    }
}

function loop() {
    if (game.running) {
        for (let i = 0; i < STEPS_PER_FRAME; i++) step();
        computerMove();
    }
    draw();
    requestAnimationFrame(loop);
}

/* ---------- Controls ---------- */
function setRunning(on) {
    game.running = on;
    startBtn.textContent = on ? 'Pause' : 'Start';
    if (on) canvas.focus({ preventScroll: true });
}

startBtn.addEventListener('click', () => setRunning(!game.running));
resetBtn.addEventListener('click', () => { setRunning(false); reset(); });
cpuBtn.addEventListener('click', () => {
    game.cpu = !game.cpu;
    cpuBtn.textContent = game.cpu ? 'Player B: computer' : 'Player B: human (↑/↓)';
    cpuBtn.setAttribute('aria-pressed', game.cpu);
});

// Keys: same bindings as the original (W/S for A, Up/Down for B)
document.addEventListener('keydown', e => {
    if (!game.running) return;
    const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    const moves = { w: ['paddleA', 20], s: ['paddleA', -20] };
    if (!game.cpu) Object.assign(moves, { ArrowUp: ['paddleB', 20], ArrowDown: ['paddleB', -20] });
    if (moves[key]) {
        e.preventDefault();   // stop the arrow keys from scrolling the page mid-game
        const [paddle, amount] = moves[key];
        game[paddle] += amount;
    }
});

// Touch / mouse drag: move Player A's paddle to where you drag on the field
function dragTo(e) {
    const box = canvas.getBoundingClientRect();
    const y = ((e.clientY - box.top) / box.height) * H;   // screen pixels -> game pixels
    game.paddleA = Math.round((H / 2 - y) / 20) * 20;      // snap to 20-unit steps like a key press
}
canvas.addEventListener('pointerdown', e => {
    if (!game.running) setRunning(true);
    canvas.setPointerCapture(e.pointerId);
    dragTo(e);
});
canvas.addEventListener('pointermove', e => {
    if (canvas.hasPointerCapture(e.pointerId)) dragTo(e);
});

// Pause automatically if the visitor scrolls the game out of view
new IntersectionObserver(entries => {
    if (!entries[0].isIntersecting && game.running) setRunning(false);
}).observe(canvas);

reset();
loop();
