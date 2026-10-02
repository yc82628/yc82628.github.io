/* ==========================================================================
   Daytonator demo: replays a REAL scan of the "evasive_stealer" test package.
   The data below is copied from the Daytonator repo:
   tests/sample_output_evasive.json (bait descriptions from detonator/baits.py).
   Nothing here runs malware; it only replays saved output.
   ========================================================================== */

const SCAN = {
    package: 'evasive_stealer',
    forks: [
        { bait: 'control', desc: 'Clean environment, no bait. The baseline every fork is compared against.', events: [] },
        { bait: 'ssh',     desc: 'A planted private SSH key. Catches packages that scrape ~/.ssh.', events: [] },
        { bait: 'aws',     desc: 'Fake cloud credentials in env + ~/.aws. Catches credential stealers.', events: [
            { kind: 'secret_read', detail: 'open .aws/credentials',
              raw: 'openat(AT_FDCWD, ".../home/.aws/credentials", O_RDONLY|O_CLOEXEC) = 3' },
            { kind: 'network', detail: 'connect 203.0.113.7:443',
              raw: 'connect(3, {sa_family=AF_INET, sin_port=htons(443), sin_addr=inet_addr("203.0.113.7")}, 16)' },
            { kind: 'exfil', detail: 'canary value left the process (aws)', raw: '' },
        ] },
        { bait: 'prod',    desc: "Looks like a production host. Catches malware that only fires in 'real' envs.", events: [] },
        { bait: 'clock',   desc: 'Jumps the system clock forward. Trips time-bombs.', events: [] },
    ],
    verdict: {
        label: 'MALICIOUS',
        score: 95,
        triggeredBy: 'aws',
        explanation: 'Reads planted secrets and opens a network connection in the aws fork(s) while staying silent on the clean run. Credential theft that hides from a normal sandbox.',
        evidence: [
            'exfil: canary value left the process (aws)',
            'network: connect 203.0.113.7:443',
            'secret_read: open .aws/credentials',
        ],
    },
};

const demo = document.querySelector('#daytonator-demo');
const steps = demo.querySelectorAll('.pipeline-steps span');
const forksEl = demo.querySelector('.forks');
const verdictEl = demo.querySelector('.verdict');
const replayBtn = demo.querySelector('#replay');

// Full-width panel under the forks for the raw strace lines (too long for a fork card)
const traceOut = document.createElement('div');
traceOut.className = 'term trace-out';
traceOut.hidden = true;
forksEl.after(traceOut);

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
let runId = 0;   // lets "Replay" cancel a run that's still playing

// Build one card per fork
forksEl.innerHTML = SCAN.forks.map(f => `
    <div class="fork" data-bait="${f.bait}">
        <div class="fork-name">${f.bait}</div>
        <div class="fork-bait">${f.desc}</div>
        <span class="pill">waiting</span>
        <div class="term" aria-live="polite"></div>
    </div>`).join('');

function setPill(fork, state, text) {
    const pill = fork.querySelector('.pill');
    pill.className = 'pill ' + state;
    pill.textContent = text;
}

function reset() {
    steps.forEach(s => s.classList.remove('done'));
    forksEl.querySelectorAll('.fork').forEach(fork => {
        fork.classList.remove('triggered');
        setPill(fork, '', 'waiting');
        fork.querySelector('.term').textContent = '';
    });
    verdictEl.hidden = true;
    traceOut.hidden = true;
    traceOut.innerHTML = '';
}

async function run() {
    const id = ++runId;
    const alive = () => id === runId;
    reset();
    replayBtn.textContent = 'Running…';

    // 1. Snapshot  2. Fork
    steps[0].classList.add('done'); await wait(600); if (!alive()) return;
    steps[1].classList.add('done'); await wait(500); if (!alive()) return;

    // 3. Detonate in every fork at once
    steps[2].classList.add('done');
    const cards = [...forksEl.querySelectorAll('.fork')];
    cards.forEach(card => setPill(card, 'running', 'detonating'));
    await wait(1100); if (!alive()) return;

    // Quiet forks finish; the baited fork streams its strace events
    for (const [i, fork] of SCAN.forks.entries()) {
        const card = cards[i];
        const term = card.querySelector('.term');
        if (fork.events.length === 0) {
            setPill(card, 'ok', '0 events');
            term.innerHTML = '<span class="good">exit 0 · nothing suspicious</span>';
            await wait(250);
        } else {
            card.classList.add('triggered');
            setPill(card, 'bad', fork.events.length + ' events');
            traceOut.hidden = false;
            traceOut.innerHTML = `<span class="good"># strace, ${fork.bait} fork</span>\n`;
            for (const ev of fork.events) {
                // Short summary in the card, the raw system call in the wide panel below
                term.innerHTML += `<span class="hit">${ev.kind}</span> ${ev.detail}\n`;
                traceOut.innerHTML += ev.raw ? `${ev.raw}\n` : `<span class="hit">${ev.detail}</span>\n`;
                await wait(650); if (!alive()) return;
            }
        }
        if (!alive()) return;
    }

    // 4. Differential  5. Verdict
    steps[3].classList.add('done'); await wait(500); if (!alive()) return;
    steps[4].classList.add('done');
    verdictEl.hidden = false;
    replayBtn.textContent = 'Replay scan';
}

// Fill in the verdict panel (shown at the end of the run)
const v = SCAN.verdict;
verdictEl.querySelector('.verdict-label').textContent = v.label;
verdictEl.querySelector('.verdict-score').textContent = `${v.score}/100 · triggered by the ${v.triggeredBy} fork`;
verdictEl.querySelector('.verdict-text').textContent = v.explanation;
verdictEl.querySelector('ul').innerHTML = v.evidence.map(e => `<li>${e}</li>`).join('');

replayBtn.addEventListener('click', run);

// Start automatically the first time the demo scrolls into view
new IntersectionObserver((entries, observer) => {
    if (entries[0].isIntersecting) {
        observer.disconnect();
        run();
    }
}, { threshold: 0.35 }).observe(demo);
