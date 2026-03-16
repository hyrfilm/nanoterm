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
    const cbs = { left: () => {}, right: () => {}, top: () => {}, bottom: () => {} };

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
    dx = 1;
    dy = -1;

    constructor(private sprite: ReturnType<typeof createSprite>) {
        sprite.onLeftColl   = () => { this.dx =  1; };
        sprite.onRightColl  = () => { this.dx = -1; };
        sprite.onTopColl    = () => { this.dy =  1; };
        sprite.onBottomColl = () => { this.dy = -1; };
    }

    step()  { this.sprite.move(this.dx, this.dy); }
    update() { this.sprite.update(); }
}

// ── bounce ───────────────────────────────────────────────────────────────────

registry.register({
    name: 'bounce',
    description: 'Bouncing white square (press q to quit)',
    usage: 'bounce',
    handler: (ctx) => {
        const term = ctx.terminal;
        term.write('\x1b[?1049h\x1b[?25l');

        const W = 2, H = 2;
        const ballSprite = createSprite(term, Math.floor((term.cols - W) / 2), Math.floor((term.rows - H) / 2), W, H, WHITE);
        const p1        = createSprite(term, 0, Math.floor((term.rows - H) / 2), W, H, WHITE);
        const ball      = new Ball(ballSprite);

        term.write('\x1b[40m\x1b[2J');
        ball.update();
        p1.update();

        const step = () => {
            ball.step();
            if      (Math.random() < 0.1) p1.move(0, -1);
            else if (Math.random() < 0.1) p1.move(0,  1);
            ball.update();
            p1.update();
        };

        return new Promise((resolve) => {
            const interval        = setInterval(step, 40);
            const resizeDisposable = term.onResize(() => {});
            const dataDisposable  = term.onData((data: string) => {
                if (data === 'q' || data === 'Q' || data === '\x03') {
                    clearInterval(interval);
                    resizeDisposable.dispose();
                    dataDisposable.dispose();
                    term.write('\x1b[?1049l\x1b[?25h');
                    resolve({ exitCode: 0 });
                }
            });
        });
    },
});

// ── pong ─────────────────────────────────────────────────────────────────────

registry.register({
    name: 'pong',
    description: 'Pong — W/S or ↑↓ to move, q to quit',
    usage: 'pong',
    handler: (ctx) => {
        const term = ctx.terminal;
        term.write('\x1b[?1049h\x1b[?25l');

        const BALL_W = 2, BALL_H = 1;
        const PAD_W  = 2, PAD_H  = 5;
        const MAX_SPEED  = 3.0;
        const SPEED_INC  = 0.12;
        const PAD_SPEED  = 2;   // player cells/tick

        let cols = term.cols;
        let rows = term.rows;

        let scoreLeft = 0, scoreRight = 0;
        let speed = 1.0;
        let bdx = 1, bdy = 1;
        let accumBx = 0.0, accumBy = 0.0;
        let ballX = 0, ballY = 0;
        let p1y = 0;    // player (left) paddle y
        let p2y = 0;    // AI (right) paddle y
        let p1dy = 0;   // player input direction for this tick
        let aiTarget = -1;

        const P2_X = () => cols - PAD_W;

        const resetBall = (towardRight: boolean) => {
            speed    = 1.0;
            ballX    = Math.floor((cols - BALL_W) / 2);
            ballY    = Math.floor((rows - BALL_H) / 2);
            accumBx  = ballX;
            accumBy  = ballY;
            bdx      = towardRight ? 1 : -1;
            bdy      = Math.random() < 0.5 ? 1 : -1;
            aiTarget = -1;
        };

        const drawScore = () => {
            const s   = `${scoreLeft}  :  ${scoreRight}`;
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
            const target   = P2_X();
            const maxIter  = Math.ceil((cols * 4) / speed);
            for (let i = 0; i < maxIter; i++) {
                x += speed;
                y += dy * speed;
                if (y <= 0)              { y = 0;              dy =  1; }
                if (y >= rows - BALL_H)  { y = rows - BALL_H;  dy = -1; }
                if (x + BALL_W >= target) break;
            }
            return Math.max(0, Math.min(rows - PAD_H, Math.round(y) - Math.floor(PAD_H / 2)));
        };

        const redrawFull = () => {
            term.write(
                '\x1b[40m\x1b[2J' +
                drawDivider() +
                drawScore() +
                block(0,      p1y,  PAD_W, PAD_H, WHITE) +
                block(P2_X(), p2y,  PAD_W, PAD_H, WHITE) +
                block(ballX,  ballY, BALL_W, BALL_H, WHITE),
            );
        };

        const init = () => {
            p1y = Math.floor((rows - PAD_H) / 2);
            p2y = Math.floor((rows - PAD_H) / 2);
            resetBall(Math.random() < 0.5);
            redrawFull();
        };

        const step = () => {
            const inputDy = p1dy;
            p1dy = 0;

            // ── move ball ────────────────────────────────────────────────────
            accumBx += bdx * speed;
            accumBy += bdy * speed;
            let newBx = Math.round(accumBx);
            let newBy = Math.round(accumBy);

            // Bounce top / bottom walls
            if (newBy <= 0)             { newBy = 0;             accumBy = 0;             bdy =  1; }
            if (newBy >= rows - BALL_H) { newBy = rows - BALL_H; accumBy = rows - BALL_H; bdy = -1; }

            // ── left wall: player paddle ──────────────────────────────────────
            if (newBx <= 0) {
                newBx = 0; accumBx = 0;
                if (newBy + BALL_H > p1y && newBy < p1y + PAD_H) {
                    bdx = 1;
                    speed    = Math.min(speed + SPEED_INC, MAX_SPEED);
                    aiTarget = predictLanding();
                } else {
                    scoreRight++;
                    term.write(drawScore());
                    resetBall(false);   // serve toward player (loser)
                    redrawFull();
                    return;
                }
            }

            // ── right wall: AI paddle ─────────────────────────────────────────
            if (newBx + BALL_W >= cols) {
                newBx = cols - BALL_W; accumBx = cols - BALL_W;
                if (newBy + BALL_H > p2y && newBy < p2y + PAD_H) {
                    bdx = -1;
                    speed    = Math.min(speed + SPEED_INC, MAX_SPEED);
                    aiTarget = -1;      // ball heading left; prediction no longer needed
                } else {
                    scoreLeft++;
                    term.write(drawScore());
                    resetBall(true);    // serve toward AI (loser)
                    redrawFull();
                    return;
                }
            }

            // Lazily compute AI target whenever ball heads right
            if (bdx > 0 && aiTarget < 0) {
                aiTarget = predictLanding();
            }

            // ── move player paddle ────────────────────────────────────────────
            const newP1y = Math.max(0, Math.min(rows - PAD_H, p1y + inputDy * PAD_SPEED));

            // ── move AI paddle (1 cell/tick toward prediction) ────────────────
            // Speed is intentionally fixed at 1: the AI always knows the exact landing
            // spot, but it can't teleport — at high ball speeds it may not reach in time.
            let newP2y = p2y;
            if (aiTarget >= 0) {
                if (p2y < aiTarget) newP2y = Math.min(p2y + 1, aiTarget);
                else if (p2y > aiTarget) newP2y = Math.max(p2y - 1, aiTarget);
            }
            newP2y = Math.max(0, Math.min(rows - PAD_H, newP2y));

            // ── render deltas ─────────────────────────────────────────────────
            let buf = '';
            buf += block(ballX, ballY, BALL_W, BALL_H, BLACK);
            buf += block(newBx, newBy, BALL_W, BALL_H, WHITE);
            if (newP1y !== p1y) {
                buf += block(0,      p1y,   PAD_W, PAD_H, BLACK);
                buf += block(0,      newP1y, PAD_W, PAD_H, WHITE);
            }
            if (newP2y !== p2y) {
                buf += block(P2_X(), p2y,   PAD_W, PAD_H, BLACK);
                buf += block(P2_X(), newP2y, PAD_W, PAD_H, WHITE);
            }
            term.write(buf);

            ballX = newBx; ballY = newBy;
            p1y   = newP1y; p2y  = newP2y;
        };

        init();

        return new Promise((resolve) => {
            const interval         = setInterval(step, 40);
            const resizeDisposable = term.onResize(({ cols: c, rows: r }: { cols: number; rows: number }) => {
                cols = c; rows = r;
                redrawFull();
            });
            const dataDisposable   = term.onData((data: string) => {
                if      (data === 'w' || data === 'W' || data === '\x1b[A') p1dy = -1;
                else if (data === 's' || data === 'S' || data === '\x1b[B') p1dy =  1;
                else if (data === 'q' || data === 'Q' || data === '\x03') {
                    clearInterval(interval);
                    resizeDisposable.dispose();
                    dataDisposable.dispose();
                    term.write('\x1b[?1049l\x1b[?25h');
                    resolve({ exitCode: 0 });
                }
            });
        });
    },
});
