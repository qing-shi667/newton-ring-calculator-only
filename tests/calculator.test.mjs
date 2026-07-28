import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const scriptMatch = html.match(/<script>\s*([\s\S]*?)\s*<\/script>\s*<\/body>/);
assert.ok(scriptMatch, 'inline calculator script should be present');

function expectedUncertainty(rows, lambdaNm, deltaInst) {
  const n = rows.length;
  const x = rows.map(([k]) => k);
  const d = rows.map(([, diameter]) => diameter);
  const y = d.map((diameter) => diameter ** 2);
  const average = (values) => values.reduce((sum, value) => sum + value, 0) / values.length;
  const xBar = average(x);
  const yBar = average(y);
  const sxx = x.reduce((sum, value) => sum + (value - xBar) ** 2, 0);
  const syy = y.reduce((sum, value) => sum + (value - yBar) ** 2, 0);
  const sxy = x.reduce((sum, value, index) => sum + (value - xBar) * (y[index] - yBar), 0);
  const slope = sxy / sxx;
  const r = sxy / Math.sqrt(sxx * syy);
  const lambdaMm = lambdaNm * 1e-6;
  const uAb = Math.abs(slope) * Math.sqrt((1 / (r ** 2) - 1) / (n - 2));
  const uReading = deltaInst / Math.sqrt(3);
  const uBD = Math.hypot(uReading, uReading);
  const weightedDiameter = Math.sqrt(
    x.reduce((sum, value, index) => sum + ((value - xBar) * d[index]) ** 2, 0),
  );
  const uBb = (2 * uBD / sxx) * weightedDiameter;
  const uCb = Math.hypot(uAb, uBb);
  const radiusMm = slope / (4 * lambdaMm);
  const radiusUncertaintyMm = uCb / (4 * lambdaMm);

  return {
    uReading,
    uBD,
    uAb,
    uBb,
    uCb,
    radiusMm,
    radiusUncertaintyMm,
  };
}

function createHarness() {
  const elements = {
    lambda: { value: '589.3' },
    deltaInst: { value: '0.005' },
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

test('runFit formats report output without negative intercept sign, expanded uncertainty row, or parenthesized k suffix', () => {
  const { context, elements } = createHarness();
  elements.dataInput.value = [
    '10 6.2450',
    '11 6.5574',
    '12 6.8557',
  ].join('\n');

  context.runFit();

  assert.doesNotMatch(elements.result.innerHTML, /\+ -/);
  assert.match(elements.result.innerHTML, /拟合方程：D²ₖ = [\d.]+k \+ [\d.]+/);
  assert.doesNotMatch(elements.result.innerHTML, /扩展不确定度/);
  assert.doesNotMatch(elements.result.innerHTML, /\(k=2\)/);
  assert.match(elements.result.innerHTML, /最终结果：<strong>R = \d+\.\d{3}（\d+\.\d{3}）m<\/strong>/);
  assert.doesNotMatch(elements.result.innerHTML, /±/);
});

test('runFit calculates uncertainty from slope A and B components', () => {
  const { context, elements } = createHarness();
  const rows = [
    [9, 5.832],
    [10, 6.170],
    [11, 6.461],
    [12, 6.734],
    [13, 7.011],
    [14, 7.292],
    [15, 7.539],
    [16, 7.802],
    [17, 8.011],
    [18, 8.270],
    [19, 8.491],
    [20, 8.724],
  ];
  elements.dataInput.value = rows.map(([k, diameter]) => `${k} ${diameter}`).join('\n');
  elements.deltaInst.value = '0.005';
  const expected = expectedUncertainty(rows, 589.3, 0.005);

  context.runFit();

  assert.match(html, /id="deltaInst" value="0\.005"/);
  assert.match(elements.result.innerHTML, new RegExp(`单次读数标准不确定度 u = ${expected.uReading.toFixed(6)} mm`));
  assert.match(elements.result.innerHTML, new RegExp(`直径B类不确定度 u_B\\(D\\) = ${expected.uBD.toFixed(6)} mm`));
  assert.match(elements.result.innerHTML, new RegExp(`斜率A类不确定度 u_A\\(b\\) = ${expected.uAb.toFixed(6)} mm²`));
  assert.match(elements.result.innerHTML, new RegExp(`斜率B类不确定度 u_B\\(b\\) = ${expected.uBb.toFixed(6)} mm²`));
  assert.match(elements.result.innerHTML, new RegExp(`合成斜率标准不确定度 U\\(b\\) = ${expected.uCb.toFixed(6)} mm²`));
  assert.match(elements.result.innerHTML, new RegExp(`曲率半径标准不确定度 U\\(R\\) = ${expected.radiusUncertaintyMm.toFixed(3)} mm`));
  assert.match(
    elements.result.innerHTML,
    new RegExp(`最终结果：<strong>R = ${(expected.radiusMm / 1000).toFixed(3)}（${(expected.radiusUncertaintyMm / 1000).toFixed(3)}）m<\\/strong>`),
  );
});
