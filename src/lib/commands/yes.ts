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

function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}

function reflectIntoBounds(value: number, max: number): number {
    if (max <= 0) return 0;
    let reflected = value;
    while (reflected < 0 || reflected > max) {
        if (reflected < 0) reflected = -reflected;
        else reflected = 2 * max - reflected;
    }
    return reflected;
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
        const MAX_SPEED = 5.0;
        const SPEED_INC = 0.12;
        const PAD_SPEED = 2;     // player cells/tick
        const AI_REACT_TICKS = 8;     // ticks of reaction delay after player hits
        const AI_MAX_ERROR = 14;     // max cells of prediction error (±)
        const MIN_PLAYABLE_COLS = PAD_W * 2 + BALL_W + 2;
        const MIN_PLAYABLE_ROWS = Math.max(PAD_H, BALL_H) + 1;
        const SCORE_PAUSE_MS = 900;
        const IMPACT_SERIES = [100, 200, 300, 400];

        let cols = term.cols;
        let rows = term.rows;

        let scoreLeft = 0, scoreRight = 0;
        let speed = 1.0;
        let bdx = 1, bdy = 1;
        let accumBx = 0.0, accumBy = 0.0;
        let ballX = 0, ballY = 0;
        let p1y = 0;    // player (left) paddle y
        let p2y = 0;    // AI (right) paddle y
        let p1dir = 0;
        let p1UpPressed = false;
        let p1DownPressed = false;
        // AI state: reacts after a delay and aims at a noisy prediction that
        // decays toward the true landing spot as the ball gets closer.
        let aiError = 0;   // current prediction offset (cells); fades with distance
        let aiReactDelay = 0;   // ticks before AI starts tracking
        let pauseUntil = 0;
        let audioCtx: AudioContext | null = null;
        let audioBlocked = false;

        const getAudioContext = (): AudioContext | null => {
            if (audioBlocked || typeof window === 'undefined') return null;
            if (audioCtx) return audioCtx;
            const AudioContextCtor = window.AudioContext
                || (window as Window & typeof globalThis & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
            if (!AudioContextCtor) {
                audioBlocked = true;
                return null;
            }
            audioCtx = new AudioContextCtor();
            return audioCtx;
        };

        const playImpact = (impact: number, type: OscillatorType) => {
            const ctx = getAudioContext();
            if (!ctx || ctx.state !== 'running') return;

            const normalized = clamp((impact - 0.6) / 2.8, 0, 1);
            const noteIndex = Math.min(IMPACT_SERIES.length - 1, Math.round(normalized * (IMPACT_SERIES.length - 1)));
            const duration = 0.03 + (1 - normalized) * 0.08;
            const now = ctx.currentTime;
            const oscillator = ctx.createOscillator();
            const gain = ctx.createGain();

            oscillator.type = type;
            oscillator.frequency.setValueAtTime(IMPACT_SERIES[noteIndex], now);
            gain.gain.setValueAtTime(0.0001, now);
            gain.gain.exponentialRampToValueAtTime(0.05 + normalized * 0.03, now + 0.005);
            gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

            oscillator.connect(gain);
            gain.connect(ctx.destination);
            oscillator.start(now);
            oscillator.stop(now + duration + 0.01);
        };

        const startPointPause = (ms: number) => {
            pauseUntil = Date.now() + ms;
        };

        const syncP1Direction = () => {
            if (p1UpPressed === p1DownPressed) p1dir = 0;
            else p1dir = p1UpPressed ? -1 : 1;
        };

        const P2_X = () => cols - PAD_W;
        // Ball bounces at the paddle face, not the wall, so ball and paddle
        // never share the same columns — eliminates the dirty-erase trail.
        const P1_FACE = PAD_W;                       // left face: ball left-edge stops here
        const P2_FACE = () => cols - PAD_W - BALL_W; // right face: ball left-edge stops here

        const resetBall = () => {
            speed = 1.5;
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
            const col = Math.max(1, Math.floor((cols - s.length) / 2) + 1);
            return `\x1b[1;${col}H\x1b[1;37m${s}\x1b[0m`;
        };

        const isPlayable = () => cols >= MIN_PLAYABLE_COLS && rows >= MIN_PLAYABLE_ROWS;

        const clampPositions = () => {
            const maxBallX = Math.max(0, cols - BALL_W);
            const maxBallY = Math.max(0, rows - BALL_H);
            const maxPaddleY = Math.max(0, rows - PAD_H);

            ballX = clamp(ballX, 0, maxBallX);
            ballY = clamp(ballY, 0, maxBallY);
            accumBx = clamp(accumBx, 0, maxBallX);
            accumBy = clamp(accumBy, 0, maxBallY);
            p1y = clamp(p1y, 0, maxPaddleY);
            p2y = clamp(p2y, 0, maxPaddleY);
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
            if (!isPlayable()) {
                const msg = 'Terminal too small for pong';
                const row = Math.max(1, Math.floor(rows / 2) + 1);
                const col = Math.max(1, Math.floor((cols - msg.length) / 2) + 1);
                term.write(`\x1b[40m\x1b[2J\x1b[${row};${col}H\x1b[1;37m${msg}\x1b[0m`);
                return;
            }
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
            clampPositions();
            redrawFull();
        };

        const step = () => {
            if (!isPlayable()) return;
            if (pauseUntil > Date.now()) return;
            pauseUntil = 0;

            const newP1y = clamp(p1y + p1dir * PAD_SPEED, 0, rows - PAD_H);

            // ── move ball ────────────────────────────────────────────────────
            const prevAccumBx = accumBx;
            const prevAccumBy = accumBy;
            accumBx += bdx * speed;
            accumBy += bdy * speed;
            const rawAccumBy = accumBy; // snapshot before wall-bounce clamping
            let newBx = Math.round(accumBx);
            let newBy = Math.round(accumBy);

            // Bounce top / bottom walls (may overwrite accumBy)
            if (newBy <= 0) {
                newBy = 0;
                accumBy = 0;
                bdy = Math.abs(bdy);
                playImpact(Math.abs(bdy) * speed, 'sine');
            }
            if (newBy >= rows - BALL_H) {
                newBy = rows - BALL_H;
                accumBy = rows - BALL_H;
                bdy = -Math.abs(bdy);
                playImpact(Math.abs(bdy) * speed, 'sine');
            }

            // Interpolate the ball's Y at the exact X where it crosses a paddle
            // face. Uses rawAccumBy (pre-wall-clamp) so that a ball crossing both
            // a wall and a paddle face in the same tick still gets the right hitY.
            const yAtX = (targetX: number): number => {
                const dx = accumBx - prevAccumBx;
                if (dx === 0) return newBy;
                const t = (targetX - prevAccumBx) / dx;
                const rawY = prevAccumBy + t * (rawAccumBy - prevAccumBy);
                return Math.round(reflectIntoBounds(rawY, Math.max(0, rows - BALL_H)));
            };

            // ── left paddle face ──────────────────────────────────────────────
            // Use float accumBx (not rounded newBx) to avoid triggering one tick
            // early when the ball hasn't truly crossed the face yet.
            if (accumBx <= P1_FACE) {
                const hitY = yAtX(P1_FACE);
                newBx = P1_FACE; accumBx = P1_FACE;
                if (hitY + BALL_H > newP1y && hitY < newP1y + PAD_H) {
                    bdx = 1;
                    speed = Math.min(speed + SPEED_INC, MAX_SPEED);
                    playImpact(speed + Math.abs(bdy), 'sawtooth');
                    // AI takes a moment to react, and starts with a noisy
                    // prediction — the error fades as the ball gets closer.
                    aiError = Math.round((Math.random() * 2 - 1) * AI_MAX_ERROR);
                    aiReactDelay = AI_REACT_TICKS;
                } else {
                    scoreRight++;
                    resetBall();
                    clampPositions();
                    startPointPause(SCORE_PAUSE_MS);
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
                    playImpact(speed + Math.abs(bdy), 'triangle');
                } else {
                    scoreLeft++;
                    resetBall();
                    clampPositions();
                    redrawFull();
                    return;
                }
            }

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
        term.focus();
        term.write('\x1b[?25l');

        return new Promise((resolve) => {
            const interval = setInterval(step, 40);
            const resizeDisposable = term.onResize(({ cols: c, rows: r }: { cols: number; rows: number }) => {
                cols = Math.max(1, c);
                rows = Math.max(1, r);
                clampPositions();
                redrawFull();
            });
            let finished = false;
            const stopGame = () => {
                if (finished) return;
                finished = true;
                clearInterval(interval);
                resizeDisposable.dispose();
                dataDisposable.dispose();
                p1UpPressed = false;
                p1DownPressed = false;
                syncP1Direction();
                term.attachCustomKeyEventHandler(() => true);
                void audioCtx?.close().catch(() => { });
                audioCtx = null;
                if (ctx.shell) ctx.shell.activeEditor = null;
                term.write('\x1b[?1049l\x1b[?25h');
                resolve({ exitCode: 0 });
            };
            term.attachCustomKeyEventHandler((event: KeyboardEvent) => {
                if (finished) return true;

                const isUp = event.key === 'w' || event.key === 'W' || event.key === 'ArrowUp';
                const isDown = event.key === 's' || event.key === 'S' || event.key === 'ArrowDown';
                const isQuit = event.key === 'q' || event.key === 'Q' || (event.key === 'c' && event.ctrlKey);
                const shouldCapture = isUp || isDown || isQuit;

                if (!shouldCapture) return true;

                if (event.type === 'keydown') {
                    void getAudioContext()?.resume();
                    if (isUp) p1UpPressed = true;
                    else if (isDown) p1DownPressed = true;
                    else if (isQuit) {
                        stopGame();
                    }
                } else if (event.type === 'keyup') {
                    if (isUp) p1UpPressed = false;
                    else if (isDown) p1DownPressed = false;
                }

                syncP1Direction();
                event.preventDefault();
                event.stopPropagation();
                return false;
            });
            const dataDisposable = term.onData((data: string) => {
                if (data === 'q' || data === 'Q' || data === '\x03') stopGame();
            });
        });
    },
});
