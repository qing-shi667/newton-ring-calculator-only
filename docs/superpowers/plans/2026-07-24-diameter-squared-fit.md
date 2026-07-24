# Diameter-Squared Fit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Correct the calculator-only Newton's rings page so it fits measured diameter squared and displays the formula as `D²ₖ`.

**Architecture:** Keep the single-page static app intact. Add a Node-based behavior test that executes the inline calculator script with a mocked DOM and Chart, then update only the regression ordinate, radius calculation factor, visible formula labels, and README description.

**Tech Stack:** Static HTML, inline JavaScript, Chart.js, Node.js built-in `node:test`, `node:assert`, `node:vm`.

---

## File Structure

- Create: `tests/calculator.test.mjs` - extracts the inline script from `index.html`, mocks DOM/Chart, calls `runFit()`, and asserts the diameter-squared behavior.
- Modify: `index.html` - replace `r²` regression with `D²`, use `R = slope/(4λ)`, and update chart/result labels to `D²ₖ`.
- Modify: `README.md` - describe the chart as `D²ₖ-k`.

### Task 1: Behavior Test

**Files:**
- Create: `tests/calculator.test.mjs`

- [ ] **Step 1: Write the failing test**

Create `tests/calculator.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const scriptMatch = html.match(/<script>\s*([\s\S]*?)\s*<\/script>\s*<\/body>/);
assert.ok(scriptMatch, 'inline calculator script should be present');

function createHarness() {
  const elements = {
    lambda: { value: '589.3' },
    deltaInst: { value: '0.004' },
    dataInput: { value: '10 7.011\n11 7.348\n12 7.670' },
    result: { innerHTML: '' },
    fitChart: { getContext: () => ({}) },
  };

  let latestChartConfig = null;
  function Chart(_ctx, config) {
    latestChartConfig = config;
    this.destroy = () => {};
  }

  const context = {
    console,
    alert: (message) => {
      throw new Error(`Unexpected alert: ${message}`);
    },
    document: {
      getElementById: (id) => {
        assert.ok(elements[id], `missing mocked element: ${id}`);
        return elements[id];
      },
    },
    Chart,
  };

  vm.createContext(context);
  vm.runInContext(scriptMatch[1], context);
  return { context, elements, getChartConfig: () => latestChartConfig };
}

test('runFit uses measured diameter squared and D²ₖ labels', () => {
  const { context, elements, getChartConfig } = createHarness();

  context.runFit();

  const chart = getChartConfig();
  assert.ok(chart, 'Chart should be created');

  const plottedData = chart.data.datasets[0].data;
  assert.equal(plottedData[0].x, 10);
  assert.equal(plottedData[0].y, 7.011 * 7.011);
  assert.notEqual(plottedData[0].y, (7.011 / 2) ** 2);

  assert.match(elements.result.innerHTML, /拟合方程：D²ₖ = /);
  assert.doesNotMatch(elements.result.innerHTML, /r²/);
  assert.equal(chart.data.datasets[0].label, '实验数据(k, D²ₖ)');
  assert.equal(chart.options.scales.y.title.text, 'D²ₖ (mm²)');

  const slope = context.linearRegression(
    [10, 11, 12],
    [7.011 ** 2, 7.348 ** 2, 7.67 ** 2],
  ).slope;
  const expectedR = slope / (4 * 589.3e-6);
  assert.match(elements.result.innerHTML, new RegExp(`曲率半径 R = ${expectedR.toFixed(2)} mm`));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/calculator.test.mjs`

Expected: FAIL because the plotted y value is `(D/2)^2`, the result equation still contains `r²`, and the chart y-axis still contains `r²`.

- [ ] **Step 3: Commit the failing test**

Run:

```bash
git add tests/calculator.test.mjs
git commit -m "test: cover diameter squared regression"
```

### Task 2: Calculator Logic and Labels

**Files:**
- Modify: `index.html`
- Test: `tests/calculator.test.mjs`

- [ ] **Step 1: Update ordinate calculation**

Replace:

```js
// 计算 r²
const r = d.map(x=>x/2);
const y = r.map(ri=>ri*ri);
```

With:

```js
// 计算 D²
const y = d.map(di=>di*di);
```

- [ ] **Step 2: Update slope naming and radius propagation**

Replace:

```js
const b = fit.slope;
const sb = fit.sb;
```

With:

```js
const slopeD2 = fit.slope;
const sbD2 = fit.sb;
```

Replace:

```js
const R_mm = b / lambda_mm;
const uA_R = sb / lambda_mm;
```

With:

```js
const R_mm = slopeD2 / (4 * lambda_mm);
const uA_R = sbD2 / (4 * lambda_mm);
```

- [ ] **Step 3: Update result and chart text**

Use `D²ₖ` in the result equation, chart legend, and y-axis:

```js
拟合方程：D²ₖ = ${slopeD2.toFixed(4)}k + ${fit.intercept.toFixed(4)}<br>
斜率标准不确定度 u(b) = ${sbD2.toFixed(6)} mm²<br>
label:'实验数据(k, D²ₖ)',
y:{title:{display:true,text:'D²ₖ (mm²)'}}
```

Update fit line calculation:

```js
const fitY = x.map(xi=>slopeD2*xi+fit.intercept);
```

- [ ] **Step 4: Run behavior test**

Run: `node --test tests/calculator.test.mjs`

Expected: PASS.

- [ ] **Step 5: Commit implementation**

Run:

```bash
git add index.html
git commit -m "fix: fit diameter squared for Newton rings"
```

### Task 3: Documentation and Final Verification

**Files:**
- Modify: `README.md`
- Test: `tests/calculator.test.mjs`

- [ ] **Step 1: Update README chart description**

Replace `r²-k` with `D²ₖ-k`.

- [ ] **Step 2: Verify no stale user-facing `r²` remains**

Run: `rg -n "r²|r\\^2|r虏" index.html README.md tests`

Expected: no output.

- [ ] **Step 3: Run full behavior tests**

Run: `node --test tests/calculator.test.mjs`

Expected: PASS.

- [ ] **Step 4: Commit docs**

Run:

```bash
git add README.md
git commit -m "docs: describe diameter squared chart"
```

- [ ] **Step 5: Push and verify remote**

Run:

```bash
git push origin main
git ls-remote origin refs/heads/main
```

Expected: remote `main` points at the latest local commit.

## Self-Review

- Spec coverage: calculation uses `D²`, displays `D²ₖ`, divides slope and slope uncertainty by `4λ`, preserves layout and uncertainty flow, updates README.
- Placeholder scan: no placeholders remain.
- Type consistency: test harness uses the existing global `runFit`, `linearRegression`, DOM ids, and Chart config names exactly as the page uses them.
