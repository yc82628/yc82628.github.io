/* ==========================================================================
   Medical imaging demo: the safety checks that run BEFORE the model.
   The gate results below are REAL outputs of assess_quality() and
   verify_is_fundus() from preprocessing.py, run on three synthetic images
   made by make_demo_data.py. The decision rule (operating point 0.35,
   abstention band 0.22–0.52) is copied from DemoPredictor in predictor.py.
   ========================================================================== */

const THRESHOLDS = { minBlur: 40, minFov: 0.25, minBrightness: 20, maxBrightness: 235 };

const CASES = [
    { img: 'demos/img/retina-p0003-right.jpg', name: 'P0003 right', label: 'Grade 0 (no DR)',
      blur: 255.0, fov: 0.706, brightness: 104.7, gradable: true,  reasons: [],
      fundus: true, anatomyScore: 0.937, opticDisc: true },
    { img: 'demos/img/retina-p0006-left.jpg', name: 'P0006 left', label: 'Grade 2 (referable)',
      blur: 295.7, fov: 0.706, brightness: 104.5, gradable: true,  reasons: [],
      fundus: true, anatomyScore: 0.948, opticDisc: true },
    { img: 'demos/img/retina-p0007-right.jpg', name: 'P0007 right', label: 'Blurred capture',
      blur: 1.1,   fov: 0.729, brightness: 101.3, gradable: false, reasons: ['image too blurred (laplacian var 1.1)'],
      fundus: true, anatomyScore: 0.940, opticDisc: true },
];

const demo = document.querySelector('#medical-demo');
const picker = demo.querySelector('.retina-picker');
const gates = demo.querySelector('.gate-list');

picker.innerHTML = CASES.map((c, i) => `
    <button type="button" class="retina-option" data-index="${i}" aria-pressed="${i === 0}">
        <img src="${c.img}" alt="Synthetic retina image ${c.name}" loading="lazy">
        <span>${c.name}<br><small style="color: var(--muted)">${c.label}</small></span>
    </button>`).join('');

const check = (ok, text) => `<span class="${ok ? 'good' : 'hit'}">${ok ? '✓' : '✗'}</span> ${text}`;

function show(index) {
    const c = CASES[index];
    picker.querySelectorAll('.retina-option').forEach((btn, i) => btn.setAttribute('aria-pressed', i === index));

    const t = THRESHOLDS;
    const quality = [
        check(c.blur >= t.minBlur, `sharpness  ${c.blur.toFixed(1)}  (needs ≥ ${t.minBlur})`),
        check(c.fov >= t.minFov, `field of view  ${(c.fov * 100).toFixed(0)}%  (needs ≥ ${t.minFov * 100}%)`),
        check(c.brightness >= t.minBrightness && c.brightness <= t.maxBrightness,
              `brightness  ${c.brightness.toFixed(1)}  (needs ${t.minBrightness}–${t.maxBrightness})`),
    ].join('\n');

    const anatomy = [
        check(c.fundus, `looks like a retina  (score ${c.anatomyScore.toFixed(2)})`),
        check(c.opticDisc, 'optic disc found'),
    ].join('\n');

    const decision = c.gradable
        ? `<span class="pill ok">passes to model</span>`
        : `<span class="pill warn">manual review</span>`;

    gates.innerHTML = `
        <li class="gate">
            <span class="gate-step">01</span>
            <div><h4>Quality gate</h4><p>Is the photo good enough to grade at all?</p><div class="term">${quality}</div></div>
            <span class="pill ${c.gradable ? 'ok' : 'bad'}">${c.gradable ? 'gradable' : 'ungradable'}</span>
        </li>
        <li class="gate">
            <span class="gate-step">02</span>
            <div><h4>Anatomy gate</h4><p>Is this actually a retina, not a wall, a document or an X-ray?</p><div class="term">${anatomy}</div></div>
            <span class="pill ${c.fundus ? 'ok' : 'bad'}">${c.fundus ? 'retina' : 'rejected'}</span>
        </li>
        <li class="gate">
            <span class="gate-step">03</span>
            <div><h4>Model → calibrated probability</h4>
            <p>${c.gradable
                ? 'Only images that pass both gates reach the ordinal model, which outputs a calibrated probability of referable DR. Try the decision rule with the slider below.'
                : 'Skipped. An ungradable image never reaches the model: it is routed to a human with a recapture request. <strong>Calling a blurred photo "healthy" is the failure that actually harms patients.</strong>'}</p></div>
            ${decision}
        </li>`;
}

picker.addEventListener('click', e => {
    const btn = e.target.closest('.retina-option');
    if (btn) show(Number(btn.dataset.index));
});
show(0);


/* ---------- Decision axis: the real rule from predictor.py ---------- */

const OPERATING_POINT = 0.35;
const BAND = [0.22, 0.52];

const axis = demo.querySelector('.axis');
const slider = axis.querySelector('input');
const dot = axis.querySelector('.axis-dot');
const pill = demo.querySelector('#decision-pill');
const why = demo.querySelector('#decision-why');

// Position the band and the operating-point marker on the line
const pct = p => (p * 100) + '%';
axis.querySelector('.axis-band').style.left = pct(BAND[0]);
axis.querySelector('.axis-band').style.width = pct(BAND[1] - BAND[0]);
axis.querySelector('.axis-op').style.left = pct(OPERATING_POINT);
axis.querySelector('.axis-label.op').style.left = pct(OPERATING_POINT);
axis.querySelector('.axis-label.band').style.left = pct((BAND[0] + BAND[1]) / 2);

function decide() {
    const p = slider.value / 100;
    dot.style.left = pct(p);

    let state, label, text;
    if (p > BAND[0] && p < BAND[1]) {
        state = 'warn'; label = 'Manual review';
        text = `P = ${p.toFixed(2)} falls inside the abstention band (${BAND[0]}–${BAND[1]}). Too close to call, so the system defers to a human grader by design.`;
    } else if (p >= OPERATING_POINT) {
        state = 'bad'; label = 'Refer';
        text = `P = ${p.toFixed(2)} is at or above the operating point (${OPERATING_POINT}). Refer to an ophthalmologist.`;
    } else {
        state = 'ok'; label = 'Routine rescreen';
        text = `P = ${p.toFixed(2)} is confidently below the operating point. Routine rescreening.`;
    }
    pill.className = 'pill ' + state;
    pill.textContent = label;
    why.textContent = text;
    slider.setAttribute('aria-valuetext', `${p.toFixed(2)}: ${label}`);
}

slider.addEventListener('input', decide);
decide();
