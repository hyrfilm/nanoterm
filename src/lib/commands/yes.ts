import { registry } from '../core/commandRegistry';

const WHITE = '\x1b[107m';
const BLACK = '\x1b[40m';

function block(px: number, py: number, w: number, h: number, color: string): string {
    let buf = '';
    for (let row = 0; row < h; row++) {
        buf += `\x1b[${py + row + 1};${px + 1}H${color}${' '.repeat(w)}\x1b[0m`;
    }
    return buf;
}

// createSprite: collision callbacks are stored in a mutable 'cbs' object so that
// external assignment (sprite.onXxxColl = ...) is reflected inside clip().
const createSprite = (
    terminal: { cols: number; rows: number; write: (s: string) => void },
    px: number, py: number, w: number, h: number, color: string,
) => {
    let posX = px, posY = py, prevX = px, prevY = py;
    const cbs = { left: () => { }, right: () => { }, top: () => { }, bottom: () => { } };

    const clip = (x: number, y: number): [number, number] => {
        if (x <= 0) { x = 0; cbs.left(); }
        else if (x >= terminal.cols - w) { x = terminal.cols - w; cbs.right(); }
        if (y <= 0) { y = 0; cbs.top(); }
        else if (y >= terminal.rows - h) { y = terminal.rows - h; cbs.bottom(); }
        return [x, y];
    };

    const setPos = (x: number, y: number) => {
        prevX = posX; prevY = posY;
        [posX, posY] = clip(x, y);
    };

    return {
        get x() { return posX; },
        get y() { return posY; },
        setPos,
        move: (dx: number, dy: number) => setPos(posX + dx, posY + dy),
        update: () => terminal.write(block(prevX, prevY, w, h, BLACK) + block(posX, posY, w, h, color)),
        set onLeftColl(f: () => void) { cbs.left = f; },
        set onRightColl(f: () => void) { cbs.right = f; },
        set onTopColl(f: () => void) { cbs.top = f; },
        set onBottomColl(f: () => void) { cbs.bottom = f; },
    };
};

class Ball {
    dx = 1 + Math.random();
    dy = -1 + Math.random();

    constructor(private sprite: ReturnType<typeof createSprite>) {
        sprite.onLeftColl = () => { this.dx = Math.abs(this.dx); };
        sprite.onRightColl = () => { this.dx = -Math.abs(this.dx); };
        sprite.onTopColl = () => { this.dy = Math.abs(this.dy); };
        sprite.onBottomColl = () => { this.dy = -Math.abs(this.dy); };
    }

    step() { this.sprite.move(this.dx, this.dy); }
    update() { this.sprite.update(); }
}

registry.register({
    name: 'pong',
    description: 'Pong — W/S or ↑↓ to move, q to quit',
    usage: 'pong',
    handler: (ctx) => {
        const term = ctx.terminal;
        term.write('\x1b[?1049h\x1b[?25l');

        // Claim the shell's activeEditor slot so handleInput() is a no-op while
        // running — prevents the shell from echoing W/S/arrow keypresses.
        if (ctx.shell) ctx.shell.activeEditor = { handleInput: () => { }, handleResize: () => { } };

        const BALL_W = 2, BALL_H = 1;
        const PAD_W = 2, PAD_H = 5;
        const MAX_SPEED = 3.0;
        const SPEED_INC = 0.12;
        const PAD_SPEED = 2;     // player cells/tick
        const AI_REACT_TICKS = 8;     // ticks of reaction delay after player hits
        const AI_MAX_ERROR = 7;     // max cells of prediction error (±)

        let cols = term.cols;
        let rows = term.rows;

        let scoreLeft = 0, scoreRight = 0;
        let speed = 1.0;
        let bdx = 1, bdy = 1;
        let accumBx = 0.0, accumBy = 0.0;
        let ballX = 0, ballY = 0;
        let p1y = 0;    // player (left) paddle y
        let p2y = 0;    // AI (right) paddle y
        // key-repeat initial delay.
        let p1dir = 0;
        let p1keyTime = 0;
        // AI state: reacts after a delay and aims at a noisy prediction that
        // decays toward the true landing spot as the ball gets closer.
        let aiError = 0;   // current prediction offset (cells); fades with distance
        let aiReactDelay = 0;   // ticks before AI starts tracking

        const P2_X = () => cols - PAD_W;
        // Ball bounces at the paddle face, not the wall, so ball and paddle
        // never share the same columns — eliminates the dirty-erase trail.
        const P1_FACE = PAD_W;                       // left face: ball left-edge stops here
        const P2_FACE = () => cols - PAD_W - BALL_W; // right face: ball left-edge stops here

        const resetBall = () => {
            speed = 0.5;
            // Vary the serve angle
            bdy = (0.3 + Math.random() * 0.9) * (Math.random() < 0.5 ? 1 : -1);
            bdx = 1;   // always toward AI — gives player time to set up
            ballY = Math.floor(rows * (0.15 + Math.random() * 0.7));
            ballX = Math.floor((cols - BALL_W) / 2);
            accumBx = ballX;
            accumBy = ballY;
            aiError = 0;
            aiReactDelay = 0;
        };

        const drawScore = () => {
            const s = `${scoreLeft}  :  ${scoreRight}`;
            const col = Math.floor((cols - s.length) / 2) + 1;
            return `\x1b[1;${col}H\x1b[1;37m${s}\x1b[0m`;
        };

        const drawDivider = () => {
            let buf = '';
            const mid = Math.floor(cols / 2);
            for (let r = 1; r < rows; r += 2) {
                buf += `\x1b[${r + 1};${mid + 1}H\x1b[2m:\x1b[0m`;
            }
            return buf;
        };

        // Simulate the ball's trajectory and return the Y to aim the AI paddle's
        // top edge at (already adjusted to center the paddle on the landing point).
        const predictLanding = (): number => {
            let x = accumBx, y = accumBy, dy = bdy;
            const target = P2_X();
            const maxIter = Math.ceil((cols * 4) / speed);
            for (let i = 0; i < maxIter; i++) {
                x += speed;
                y += dy * speed;
                if (y <= 0) { y = 0; dy = 1; }
                if (y >= rows - BALL_H) { y = rows - BALL_H; dy = -1; }
                if (x + BALL_W >= target) break;
            }
            return Math.max(0, Math.min(rows - PAD_H, Math.round(y) - Math.floor(PAD_H / 2)));
        };

        const redrawFull = () => {
            term.write(
                '\x1b[40m\x1b[2J' +
                drawDivider() +
                drawScore() +
                block(0, p1y, PAD_W, PAD_H, WHITE) +
                block(P2_X(), p2y, PAD_W, PAD_H, WHITE) +
                block(ballX, ballY, BALL_W, BALL_H, WHITE),
            );
        };

        const init = () => {
            p1y = Math.floor((rows - PAD_H) / 2);
            p2y = Math.floor((rows - PAD_H) / 2);
            resetBall();
            redrawFull();
        };

        const step = () => {
            // Timestamp window: paddle keeps moving while key was pressed within
            // the last 150 ms, bridging the gap before key-repeat kicks in.
            const inputDy = (Date.now() - p1keyTime < 150) ? p1dir : 0;

            // ── move ball ────────────────────────────────────────────────────
            const prevAccumBx = accumBx;
            const prevAccumBy = accumBy;
            accumBx += bdx * speed;
            accumBy += bdy * speed;
            const rawAccumBy = accumBy; // snapshot before wall-bounce clamping
            let newBx = Math.round(accumBx);
            let newBy = Math.round(accumBy);

            // Bounce top / bottom walls (may overwrite accumBy)
            if (newBy <= 0) { newBy = 0; accumBy = 0; bdy = 1; }
            if (newBy >= rows - BALL_H) { newBy = rows - BALL_H; accumBy = rows - BALL_H; bdy = -1; }

            // Interpolate the ball's Y at the exact X where it crosses a paddle
            // face. Uses rawAccumBy (pre-wall-clamp) so that a ball crossing both
            // a wall and a paddle face in the same tick still gets the right hitY.
            const yAtX = (targetX: number): number => {
                const dx = accumBx - prevAccumBx;
                if (dx === 0) return newBy;
                const t = (targetX - prevAccumBx) / dx;
                return Math.round(prevAccumBy + t * (rawAccumBy - prevAccumBy));
            };

            // ── left paddle face ──────────────────────────────────────────────
            // Use float accumBx (not rounded newBx) to avoid triggering one tick
            // early when the ball hasn't truly crossed the face yet.
            if (accumBx <= P1_FACE) {
                const hitY = yAtX(P1_FACE);
                newBx = P1_FACE; accumBx = P1_FACE;
                if (hitY + BALL_H > p1y && hitY < p1y + PAD_H) {
                    bdx = 1;
                    speed = Math.min(speed + SPEED_INC, MAX_SPEED);
                    // AI takes a moment to react, and starts with a noisy
                    // prediction — the error fades as the ball gets closer.
                    aiError = Math.round((Math.random() * 2 - 1) * AI_MAX_ERROR);
                    aiReactDelay = AI_REACT_TICKS;
                } else {
                    scoreRight++;
                    term.write(drawScore());
                    resetBall();
                    redrawFull();
                    return;
                }
            }

            // ── right paddle face ─────────────────────────────────────────────
            if (accumBx >= P2_FACE()) {
                const hitY = yAtX(P2_FACE());
                newBx = P2_FACE(); accumBx = P2_FACE();
                if (hitY + BALL_H > p2y && hitY < p2y + PAD_H) {
                    bdx = -1;
                    speed = Math.min(speed + SPEED_INC, MAX_SPEED);
                } else {
                    scoreLeft++;
                    term.write(drawScore());
                    resetBall();
                    redrawFull();
                    return;
                }
            }

            // ── move player paddle ────────────────────────────────────────────
            const newP1y = Math.max(0, Math.min(rows - PAD_H, p1y + inputDy * PAD_SPEED));

            // ── move AI paddle ────────────────────────────────────────────────
            // AI waits AI_REACT_TICKS because distracted
            // Once it does, it aims at predictLanding() + an error term
            // that decays from aiError → 0 as the ball approaches so
            // starts slightly wrong and self-corrects
            let newP2y = p2y;
            if (bdx > 0) {
                if (aiReactDelay > 0) {
                    aiReactDelay--;
                } else {
                    const travel = P2_FACE() - P1_FACE;
                    const remaining = Math.max(0, P2_FACE() - accumBx);
                    const errorScale = travel > 0 ? remaining / travel : 0;
                    const aiTarget = Math.max(0, Math.min(rows - PAD_H,
                        predictLanding() + Math.round(aiError * errorScale)));
                    if (p2y < aiTarget) newP2y = Math.min(p2y + 1, aiTarget);
                    else if (p2y > aiTarget) newP2y = Math.max(p2y - 1, aiTarget);
                }
            }
            newP2y = Math.max(0, Math.min(rows - PAD_H, newP2y));

            // ── render deltas ─────────────────────────────────────────────────
            let buf = '';
            buf += block(ballX, ballY, BALL_W, BALL_H, BLACK);
            buf += block(newBx, newBy, BALL_W, BALL_H, WHITE);
            if (newP1y !== p1y) {
                buf += block(0, p1y, PAD_W, PAD_H, BLACK);
                buf += block(0, newP1y, PAD_W, PAD_H, WHITE);
            }
            if (newP2y !== p2y) {
                buf += block(P2_X(), p2y, PAD_W, PAD_H, BLACK);
                buf += block(P2_X(), newP2y, PAD_W, PAD_H, WHITE);
            }
            term.write(buf);

            ballX = newBx; ballY = newBy;
            p1y = newP1y; p2y = newP2y;
        };

        init();

        return new Promise((resolve) => {
            const interval = setInterval(step, 40);
            const resizeDisposable = term.onResize(({ cols: c, rows: r }: { cols: number; rows: number }) => {
                cols = c; rows = r;
                redrawFull();
            });
            const dataDisposable = term.onData((data: string) => {
                if (data === 'w' || data === 'W' || data === '\x1b[A') { p1dir = -1; p1keyTime = Date.now(); }
                else if (data === 's' || data === 'S' || data === '\x1b[B') { p1dir = 1; p1keyTime = Date.now(); }
                else if (data === 'q' || data === 'Q' || data === '\x03') {
                    clearInterval(interval);
                    resizeDisposable.dispose();
                    dataDisposable.dispose();
                    if (ctx.shell) ctx.shell.activeEditor = null;
                    term.write('\x1b[?1049l\x1b[?25h');
                    resolve({ exitCode: 0 });
                }
            });
        });
    },
});
