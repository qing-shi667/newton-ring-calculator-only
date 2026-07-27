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
