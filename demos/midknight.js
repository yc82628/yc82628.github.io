/* ==========================================================================
   Midknight Watcher demo: replays the REAL hackathon run.
   Every event and timestamp below comes from the repo's agents_log/
   (decisions.log, errors.log, test_runs.log, human_interventions.log)
   and test_results/summary.txt.
   ========================================================================== */

const EVENTS = [
    { time: '00:03', tag: 'agent',    text: 'Agent starts and reads the hidden 38,326-character spec: build a Knitting Compiler.' },
    { time: '00:03', tag: 'agent',    text: 'Iteration 1: PLAN. Iteration 2: EDIT_FILE writes the first knit.py.' },
    { time: '00:04', tag: 'failover', text: 'Cerebras (Qwen3-235B) returns 429 rate limit. Agent retries without losing state.' },
    { time: '00:06', tag: 'score',    text: 'Test run: 0/150. Every test flagged "stale expected output".', score: 0 },
    { time: '00:16', tag: 'failover', text: 'Cerebras 429 again, and Groq (Llama 3.3 70B) rejects the request as too large (413).' },
    { time: '00:17', tag: 'failover', text: 'Falls back to the third tier: local Ollama (Qwen3.5 9B). No work lost.' },
    { time: '00:29', tag: 'crash',    text: 'Stops after 5 unparseable replies: max_tokens was too small, so large file edits got cut off mid-JSON.' },
    { time: 'AM',    tag: 'human',    text: 'Recovery session: the test harness marked every test "stale" because of file timestamps. Fixed the timestamps, not the code: real score 11/150.', score: 11 },
    { time: 'AM',    tag: 'human',    text: 'Harness patches: max_tokens 4000 → 8000, history trimmed to 3 turns so Groq stops rejecting requests.' },
    { time: '09:58', tag: 'agent',    text: 'Resumes from checkpoint at iteration 25 instead of starting over.' },
    { time: '10:07', tag: 'crash',    text: 'All three tiers fail at once (429, 413, local timeout). Manual restart.' },
    { time: '10:29', tag: 'agent',    text: 'Resumes again from checkpoint at iteration 26.' },
    { time: '10:30', tag: 'score',    text: 'Iteration 27 test run: 14/150.', score: 14 },
    { time: '10:31', tag: 'score',    text: 'Iteration 28 rewrites knit.py: 92/150.', score: 92 },
    { time: '10:32', tag: 'crash',    text: 'Iteration 30 introduces an infinite loop on one test input.' },
    { time: 'later', tag: 'human',   text: 'Rolled knit.py back to iteration 28 with git checkout. Score preserved: 92/150.', score: 92, final: true },
];

// Final per-level public results (test_results/summary.txt)
const LEVELS = [
    ['valid_basics', 19, 20], ['stitches', 25, 25], ['brackets', 0, 25], ['row_repeats', 18, 20],
    ['single_errors', 18, 30], ['multi_error_recovery', 1, 15], ['cli_output', 5, 5], ['stress', 6, 10],
];

const demo = document.querySelector('#midknight-demo');
const log = demo.querySelector('.timeline-log');
const total = demo.querySelector('#score-total');
const bars = demo.querySelector('.bars');
const replayBtn = demo.querySelector('#replay');

bars.innerHTML = LEVELS.map(([name, passed, max]) => `
    <div class="bar-row">
        <div class="bar-label"><span>${name}</span><span>${passed}/${max}</span></div>
        <div class="bar"><i data-width="${(passed / max) * 100}" class="${passed === max ? 'full' : ''}"></i></div>
    </div>`).join('');

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
let runId = 0;

function setScore(n) { total.textContent = n; }

async function run() {
    const id = ++runId;
    log.innerHTML = '';
    setScore(0);
    bars.querySelectorAll('i').forEach(bar => (bar.style.width = '0'));
    replayBtn.textContent = 'Running…';

    for (const ev of EVENTS) {
        if (id !== runId) return;
        const li = document.createElement('li');
        li.innerHTML = `<time>${ev.time}</time><span class="tag ${ev.tag}">${ev.tag}</span><p>${ev.text}</p>`;
        log.appendChild(li);
        log.scrollTop = log.scrollHeight;
        if (ev.score !== undefined) setScore(ev.score);
        if (ev.final) bars.querySelectorAll('i').forEach(bar => (bar.style.width = bar.dataset.width + '%'));
        await wait(ev.tag === 'crash' ? 1300 : 900);
    }
    replayBtn.textContent = 'Replay run';
}

replayBtn.addEventListener('click', run);

new IntersectionObserver((entries, observer) => {
    if (entries[0].isIntersecting) {
        observer.disconnect();
        run();
    }
}, { threshold: 0.3 }).observe(demo);
