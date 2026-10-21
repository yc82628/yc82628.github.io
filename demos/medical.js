/* ==========================================================================
   Medical imaging demo: four REAL retina photos from the held-out test set.

   Images: IDRiD (Indian Diabetic Retinopathy Image Dataset), (c) Prasanna
   Porwal, Samiksha Pachade and Manesh Kokare, CC BY 4.0. Cropped to the
   retina and resized to 480 px for the web.

   Every number below is the output of the SERVED predictor (build_predictor():
   efficientnet_b3@epoch25, learned quality gate, site calibration, d8 TTA)
   run on 2026-10-22 over the 257-image evaluation half of IDRiD that nothing
   was trained, calibrated or tuned on. One case per outcome, picked by a fixed
   rule: the case whose score is closest to its group's median.
   ========================================================================== */

const THRESHOLDS = { minBlur: 12, minFov: 0.25, minBrightness: 20, maxBrightness: 235 };   // classical backstop (preprocessing.py)
const OPERATING_POINT = 2 / 3;            // 0.667, chosen for sensitivity ≥ 0.90 on the site's calibration half
const BAND = [0.2857, 0.9091];            // abstention band at 85% coverage (artifacts/evaluation.json)

const CASES = [
    { img: 'demos/img/idrid-037.jpg', name: 'IDRiD 037', truth: 'Grade 0 (no DR)', referable: false,
      pUngradable: 0.156, blur: 57.5, fov: 0.735, brightness: 99.8, fundusScore: 0.947,
      probability: 0.120, decision: 'ROUTINE', group: 80,
      verdict: 'Correct: a healthy eye, confidently cleared.' },
    { img: 'demos/img/idrid-002.jpg', name: 'IDRiD 002', truth: 'Grade 3 (severe)', referable: true,
      pUngradable: 0.379, blur: 50.1, fov: 0.735, brightness: 95.5, fundusScore: 0.982,
      probability: 1.000, decision: 'REFER', group: 114,
      verdict: 'Correct: severe retinopathy, referred.' },
    { img: 'demos/img/idrid-351.jpg', name: 'IDRiD 351', truth: 'Grade 0 (no DR)', referable: false,
      pUngradable: 0.159, blur: 51.3, fov: 0.732, brightness: 107.1, fundusScore: 0.929,
      probability: 0.703, decision: 'MANUAL_REVIEW', group: 32,
      verdict: 'The band did its job: this healthy eye scored above the operating point, so without the band it would have been a wrong referral. A human decides instead.' },
    { img: 'demos/img/idrid-067.jpg', name: 'IDRiD 067', truth: 'Grade 2 (moderate)', referable: true,
      pUngradable: 0.964, blur: 38.2, fov: 0.732, brightness: 90.2, fundusScore: 0.988,
      probability: null, decision: 'MANUAL_REVIEW', group: 8,
      verdict: 'The photo was too poor to grade, so it was not graded at all. A human sees it and asks for a new photo, which matters here: the eye does have referable retinopathy.' },
];

const DECISIONS = {
    ROUTINE: ['ok', 'Routine rescreen'],
    REFER: ['bad', 'Refer'],
    MANUAL_REVIEW: ['warn', 'Manual review'],
};

const demo = document.querySelector('#medical-demo');
const picker = demo.querySelector('.retina-picker');
const gates = demo.querySelector('.gate-list');

picker.innerHTML = CASES.map((c, i) => `
    <button type="button" class="retina-option" data-index="${i}" aria-pressed="${i === 0}">
        <img src="${c.img}" alt="Retina photo ${c.name}, graded ${c.truth} by expert graders" loading="lazy">
        <span>${c.name}<br><small style="color: var(--muted)">${c.truth}</small></span>
    </button>`).join('');

const check = (ok, text) => `<span class="${ok ? 'good' : 'hit'}">${ok ? '✓' : '✗'}</span> ${text}`;

function show(index) {
    const c = CASES[index];
    picker.querySelectorAll('.retina-option').forEach((btn, i) => btn.setAttribute('aria-pressed', i === index));

    const t = THRESHOLDS;
    const gradable = c.probability !== null;
    const quality = [
        check(c.pUngradable < 0.915, `learned quality model: P(ungradable) ${c.pUngradable.toFixed(2)}  (rejects at ≥ 0.92)`),
        check(c.blur >= t.minBlur, `backstop · sharpness  ${c.blur.toFixed(1)}  (needs ≥ ${t.minBlur})`),
        check(c.fov >= t.minFov, `backstop · field of view  ${(c.fov * 100).toFixed(0)}%  (needs ≥ ${t.minFov * 100}%)`),
        check(c.brightness >= t.minBrightness && c.brightness <= t.maxBrightness,
              `backstop · brightness  ${c.brightness.toFixed(1)}  (needs ${t.minBrightness}–${t.maxBrightness})`),
    ].join('\n');

    const [state, label] = DECISIONS[c.decision];
    const modelText = gradable
        ? `<div class="term">P(referable) = ${c.probability.toFixed(2)}  ·  calibrated for this site</div>`
        : `<p>Skipped. An ungradable photo never reaches the DR model, and is never reported as "healthy".</p>`;

    gates.innerHTML = `
        <li class="gate">
            <span class="gate-step">01</span>
            <div><h4>Quality gate</h4><p>Is the photo good enough to grade? A learned model decides; classical checks are the backstop.</p><div class="term">${quality}</div></div>
            <span class="pill ${gradable ? 'ok' : 'bad'}">${gradable ? 'gradable' : 'ungradable'}</span>
        </li>
        <li class="gate">
            <span class="gate-step">02</span>
            <div><h4>Anatomy gate</h4><p>Is this actually a retina, not a wall, a document or an X-ray?</p><div class="term">${check(true, `looks like a retina  (score ${c.fundusScore.toFixed(2)})`)}</div></div>
            <span class="pill ok">retina</span>
        </li>
        <li class="gate">
            <span class="gate-step">03</span>
            <div><h4>Model → decision</h4>${modelText}
            <p><strong>Expert graders said:</strong> ${c.truth}. ${c.verdict}</p>
            <p style="font-size: 12.5px">Typical of the ${c.group} held-out images with the same outcome.</p></div>
            <span class="pill ${state}">${label}</span>
        </li>`;

    // Put the case on the decision axis below
    if (gradable) {
        slider.value = Math.round(c.probability * 100);
        decide(`${c.name}: `);
    } else {
        pill.className = 'pill';
        pill.textContent = 'No probability';
        why.textContent = `${c.name} never reached the model, so there is nothing to place on the line. Drag the dot to try the rule.`;
    }
}

/* ---------- Decision axis: the rule the service serves ---------- */

const axis = demo.querySelector('.axis');
const slider = axis.querySelector('input');
const dot = axis.querySelector('.axis-dot');
const pill = demo.querySelector('#decision-pill');
const why = demo.querySelector('#decision-why');

const pct = p => (p * 100) + '%';
axis.querySelector('.axis-band').style.left = pct(BAND[0]);
axis.querySelector('.axis-band').style.width = pct(BAND[1] - BAND[0]);
axis.querySelector('.axis-op').style.left = pct(OPERATING_POINT);
axis.querySelector('.axis-label.op').style.left = pct(OPERATING_POINT);
axis.querySelector('.axis-label.band').style.left = pct((BAND[0] + BAND[1]) / 2);

function decide(prefix = '') {
    const p = slider.value / 100;
    dot.style.left = pct(p);

    let state, label, text;
    if (p > BAND[0] && p < BAND[1]) {
        state = 'warn'; label = 'Manual review';
        text = `P = ${p.toFixed(2)} falls inside the abstention band (${BAND[0].toFixed(2)}–${BAND[1].toFixed(2)}). Too close to call, so the system defers to a human grader by design.`;
    } else if (p >= OPERATING_POINT) {
        state = 'bad'; label = 'Refer';
        text = `P = ${p.toFixed(2)} is above the abstention band and the operating point (${OPERATING_POINT.toFixed(2)}). Refer to an ophthalmologist.`;
    } else {
        state = 'ok'; label = 'Routine rescreen';
        text = `P = ${p.toFixed(2)} is below the abstention band, confidently not referable. Routine rescreening.`;
    }
    pill.className = 'pill ' + state;
    pill.textContent = label;
    why.textContent = prefix + text;
    slider.setAttribute('aria-valuetext', `${p.toFixed(2)}: ${label}`);
}

slider.addEventListener('input', () => decide());
picker.addEventListener('click', e => {
    const btn = e.target.closest('.retina-option');
    if (btn) show(Number(btn.dataset.index));
});
show(0);
