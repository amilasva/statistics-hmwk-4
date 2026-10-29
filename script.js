
"use strict";

const COLORS = {
  navy: "#17334C",
  teal: "#168D91",
  blue: "#477FBD",
  orange: "#E49B55",
  purple: "#8B76B5",
  muted: "#728391"
};

let currentModel = "bernoulli";
let charts = {};

const $ = id => document.getElementById(id);

const modelButtons = document.querySelectorAll(".model-btn");

modelButtons.forEach(button => {
  button.addEventListener("click", () => {
    currentModel = button.dataset.model;

    modelButtons.forEach(btn => {
      btn.classList.toggle(
        "active",
        btn.dataset.model === currentModel
      );
    });

    const bernoulli = currentModel === "bernoulli";

    $("probabilityField").style.display =
      bernoulli ? "" : "none";

    $("modelExplanation").textContent = bernoulli
      ? "A successful penetration receives score 1; an unsuccessful attempt receives score 0."
      : "Each increment is equally likely to be +1 or −1, producing a symmetric process with expected value zero.";

    runSimulation();
  });
});

$("runButton").addEventListener("click", runSimulation);

function readParameters() {
  const n = Number($("nInput").value);
  const m = Number($("mInput").value);
  const p = Number($("pInput").value);

  if (
    !Number.isInteger(n) ||
    !Number.isInteger(m) ||
    n < 2 || n > 2000 ||
    m < 2 || m > 3000
  ) {
    throw new Error(
      "Enter integer values: 2 ≤ n ≤ 2000 and 2 ≤ m ≤ 3000."
    );
  }

  if (
    currentModel === "bernoulli" &&
    (!Number.isFinite(p) || p <= 0 || p >= 1)
  ) {
    throw new Error("Probability p must be between 0 and 1.");
  }

  return { n, m, p, model: currentModel };
}

function expectedValue(model, p) {
  return model === "bernoulli" ? p : 0;
}

function incrementVariance(model, p) {
  return model === "bernoulli" ? p * (1 - p) : 1;
}

function sampleIncrement(model, p) {
  const u = Math.random();

  if (model === "bernoulli") {
    return u < p ? 1 : 0;
  }

  return u < 0.5 ? 1 : -1;
}

function simulate(n, m, p, model, keepPaths = 20) {
  const totals = [];
  const averages = [];
  const normalized = [];
  const trajectories = [];

  for (let attacker = 0; attacker < m; attacker++) {
    let score = 0;
    const path = attacker < keepPaths ? [0] : null;

    for (let i = 0; i < n; i++) {
      score += sampleIncrement(model, p);

      if (path) {
        path.push(score);
      }
    }

    totals.push(score);
    averages.push(score / n);
    normalized.push(score / Math.sqrt(n));

    if (path) {
      trajectories.push(path);
    }
  }

  return { totals, averages, normalized, trajectories };
}

function mean(values) {
  return values.reduce((sum, value) => sum + value, 0)
    / values.length;
}

function variance(values) {
  const mu = mean(values);

  return values.reduce(
    (sum, value) => sum + (value - mu) ** 2,
    0
  ) / values.length;
}

function fmt(value, digits = 4) {
  return Number(value).toFixed(digits);
}

function destroyChart(id) {
  if (charts[id]) {
    charts[id].destroy();
  }
}

function createChart(id, configuration) {
  destroyChart(id);

  const canvas = $(id);

  charts[id] = new Chart(canvas, {
    ...configuration,
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      ...configuration.options
    }
  });
}

function lineOptions(xTitle, yTitle) {
  return {
    interaction: {
      mode: "nearest",
      intersect: false
    },
    plugins: {
      legend: {
        labels: {
          usePointStyle: true,
          boxWidth: 9,
          font: { size: 11 }
        }
      }
    },
    scales: {
      x: {
        title: {
          display: true,
          text: xTitle,
          color: COLORS.muted
        },
        ticks: {
          maxTicksLimit: 9
        },
        grid: {
          color: "#EEF2F3"
        }
      },
      y: {
        title: {
          display: true,
          text: yTitle,
          color: COLORS.muted
        },
        grid: {
          color: "#EEF2F3"
        }
      }
    }
  };
}

function drawTrajectories(result, params) {
  const { n, p, model } = params;

  const palette = [
    "#168D91", "#477FBD", "#E49B55",
    "#8B76B5", "#CF777B", "#65A68D",
    "#527B99", "#B78A4C"
  ];

  const datasets = result.trajectories.map((path, i) => ({
    label: `Attacker ${i + 1}`,
    data: path.map((y, x) => ({ x, y })),
    parsing: false,
    borderColor: palette[i % palette.length],
    borderWidth: 1.5,
    pointRadius: 0,
    tension: 0
  }));

  const mu = expectedValue(model, p);

  datasets.push({
    label: "Theoretical E[Sₖ]",
    data: Array.from({ length: n + 1 }, (_, k) => ({
      x: k,
      y: k * mu
    })),
    parsing: false,
    borderColor: COLORS.navy,
    borderDash: [7, 5],
    borderWidth: 2.5,
    pointRadius: 0
  });

  createChart("trajectoryChart", {
    type: "line",
    data: { datasets },
    options: {
      ...lineOptions("Observation k", "Cumulative score Sₖ"),
      scales: {
        ...lineOptions().scales,
        x: {
          type: "linear",
          title: {
            display: true,
            text: "Observation k"
          },
          min: 0,
          max: n
        },
        y: {
          title: {
            display: true,
            text: "Cumulative score Sₖ"
          }
        }
      },
      plugins: {
        legend: { display: false }
      }
    }
  });

  $("trajectoryInsight").textContent =
    model === "bernoulli"
      ? `The Bernoulli cumulative score is non-decreasing. Its expected value at step k is kp, so the theoretical final mean is ${fmt(n * p, 2)}. Different attackers follow different paths because their increments are independently generated.`
      : "Rademacher trajectories fluctuate upward and downward around an expected score of zero. Their typical spread increases with the square root of the number of observations.";
}

function histogram(values, bins = 22, fixedRange = null) {
  let min = fixedRange ? fixedRange[0] : Math.min(...values);
  let max = fixedRange ? fixedRange[1] : Math.max(...values);

  if (min === max) {
    min -= 0.5;
    max += 0.5;
  }

  const width = (max - min) / bins;
  const counts = new Array(bins).fill(0);

  values.forEach(value => {
    if (value < min || value > max) return;

    let index = Math.floor((value - min) / width);

    index = Math.max(0, Math.min(bins - 1, index));
    counts[index]++;
  });

  const centers = counts.map(
    (_, i) => min + (i + 0.5) * width
  );

  const densities = counts.map(
    count => count / (values.length * width)
  );

  return { centers, densities, width, min, max };
}

function drawHistogram(id, values, color) {
  const hist = histogram(values);

  createChart(id, {
    type: "bar",
    data: {
      labels: hist.centers.map(x => fmt(x, 2)),
      datasets: [{
        label: "Empirical frequency",
        data: hist.densities,
        backgroundColor: color,
        borderRadius: 3,
        barPercentage: 1,
        categoryPercentage: 1
      }]
    },
    options: {
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: context =>
              `Density: ${fmt(context.parsed.y, 4)}`
          }
        }
      },
      scales: {
        x: {
          ticks: {
            maxTicksLimit: 5,
            font: { size: 9 }
          },
          grid: { display: false }
        },
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: "Density"
          },
          ticks: {
            maxTicksLimit: 5
          }
        }
      }
    }
  });
}

function drawDistributions(result) {
  drawHistogram(
    "totalHistogram",
    result.totals,
    "#78B4B0"
  );

  drawHistogram(
    "averageHistogram",
    result.averages,
    "#81A7D1"
  );

  drawHistogram(
    "normalizedHistogram",
    result.normalized,
    "#D9A36D"
  );
}

function drawLLN(result, params) {
  const { n, p, model } = params;
  const mu = expectedValue(model, p);

  const datasets = result.trajectories
    .slice(0, 12)
    .map((path, i) => ({
      label: `Attacker ${i + 1}`,
      data: path.slice(1).map((score, index) => ({
        x: index + 1,
        y: score / (index + 1)
      })),
      parsing: false,
      borderColor: [
        "#168D91", "#477FBD", "#E49B55",
        "#8B76B5", "#CF777B", "#65A68D"
      ][i % 6],
      borderWidth: 1.3,
      pointRadius: 0
    }));

  datasets.push({
    label: `Expected mean = ${fmt(mu, 2)}`,
    data: [
      { x: 1, y: mu },
      { x: n, y: mu }
    ],
    parsing: false,
    borderColor: COLORS.navy,
    borderWidth: 2.5,
    borderDash: [8, 5],
    pointRadius: 0
  });

  createChart("llnChart", {
    type: "line",
    data: { datasets },
    options: {
      ...lineOptions("Number of observations", "Sₖ / k"),
      plugins: {
        legend: { display: false }
      },
      scales: {
        x: {
          type: "linear",
          min: 1,
          max: n,
          title: {
            display: true,
            text: "Number of observations"
          }
        },
        y: {
          title: {
            display: true,
            text: "Sample average"
          }
        }
      }
    }
  });

  const theoreticalVar =
    incrementVariance(model, p) / n;

  $("llnInsight").textContent =
    `The expected sample average is ${fmt(mu, 3)}. ` +
    `At n = ${n}, its theoretical variance is ` +
    `${fmt(theoreticalVar, 6)}. As n increases, ` +
    `this variance tends to zero, supporting ` +
    `convergence in probability to the expected value.`;
}

function normalPDF(x) {
  return Math.exp(-0.5 * x * x) /
    Math.sqrt(2 * Math.PI);
}

function drawCLT(result, params) {
  const { n, m, model, p } = params;

  // Both models are standardized to mean 0 and variance 1.
  // For Rademacher, this is exactly S_n / sqrt(n).
  // For Bernoulli, centering and scaling are necessary.
  const values = model === "rademacher"
    ? result.normalized
    : result.totals.map(
        s => (s - n * p) /
          Math.sqrt(n * p * (1 - p))
      );

  const hist = histogram(values, 34, [-4.5, 4.5]);

  const barData = hist.centers.map(
    (x, i) => ({ x, y: hist.densities[i] })
  );

  const curveData = Array.from(
    { length: 181 },
    (_, i) => {
      const x = -4.5 + i * 0.05;
      return { x, y: normalPDF(x) };
    }
  );

  createChart("cltChart", {
    type: "scatter",
    data: {
      datasets: [
        {
          type: "bar",
          label: "Empirical density",
          data: barData,
          parsing: false,
          backgroundColor: "rgba(22,141,145,0.55)",
          borderWidth: 0,
          barThickness: "flex"
        },
        {
          type: "line",
          label: "Standard normal N(0,1)",
          data: curveData,
          parsing: false,
          borderColor: COLORS.orange,
          borderWidth: 3,
          pointRadius: 0,
          tension: 0
        }
      ]
    },
    options: {
      ...lineOptions("Standardized score", "Density"),
      scales: {
        x: {
          type: "linear",
          min: -4.5,
          max: 4.5,
          title: {
            display: true,
            text: "Standardized score"
          }
        },
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: "Probability density"
          }
        }
      }
    }
  });

  $("cltInsight").textContent =
    model === "rademacher"
      ? `The histogram contains ${m} independent values of Sₙ/√n, with n = ${n}. As n increases, the distribution approaches the standard normal law. Increasing m makes the empirical histogram less noisy.`
      : `For Bernoulli increments, this comparison uses (Sₙ − np)/√(np(1−p)), not the uncentered Sₙ/√n. The standardized sum approaches N(0,1) as n increases, provided 0 < p < 1.`;
}

function drawVariance(params) {
  const { n, p, model } = params;
  const v = incrementVariance(model, p);

  const sizes = [...new Set([
    2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, n
  ])].sort((a, b) => a - b);

  const datasets = [
    {
      label: "Var(Sₙ)",
      data: sizes.map(k => ({ x: k, y: k * v })),
      parsing: false,
      borderColor: COLORS.blue,
      backgroundColor: COLORS.blue,
      yAxisID: "yTotal"
    },
    {
      label: "Var(Sₙ/n)",
      data: sizes.map(k => ({ x: k, y: v / k })),
      parsing: false,
      borderColor: COLORS.orange,
      backgroundColor: COLORS.orange,
      yAxisID: "yScaled"
    },
    {
      label: "Var(Sₙ/√n)",
      data: sizes.map(k => ({ x: k, y: v })),
      parsing: false,
      borderColor: COLORS.teal,
      backgroundColor: COLORS.teal,
      yAxisID: "yScaled"
    }
  ].map(dataset => ({
    ...dataset,
    borderWidth: 2.5,
    pointRadius: 3,
    tension: 0.1
  }));

  createChart("varianceChart", {
    type: "line",
    data: { datasets },
    options: {
      ...lineOptions("Number of systems n", "Variance"),
      scales: {
        x: {
          type: "linear",
          title: {
            display: true,
            text: "Number of systems n"
          }
        },
        yTotal: {
          type: "linear",
          position: "left",
          beginAtZero: true,
          title: {
            display: true,
            text: "Total-score variance"
          }
        },
        yScaled: {
          type: "linear",
          position: "right",
          beginAtZero: true,
          title: {
            display: true,
            text: "Normalized variances"
          },
          grid: {
            drawOnChartArea: false
          }
        }
      }
    }
  });
}

function comparisonSizes(n) {
  const candidates = [
    10, 25, 50, 100, 250, 500, 1000, 2000, n
  ];

  return [...new Set(
    candidates.filter(value => value <= Math.max(n, 10))
  )].sort((a, b) => a - b);
}

function drawComparison(params) {
  const { n, m, p, model } = params;

  const sizes = comparisonSizes(n);

  const rows = sizes.map(size => {
    const sample = simulate(size, m, p, model, 0);

    return {
      n: size,
      average: mean(sample.averages),
      averageVariance: variance(sample.averages),
      normalizedVariance: variance(sample.normalized)
    };
  });

  const theoreticalMean = expectedValue(model, p);

  createChart("comparisonChart", {
    type: "line",
    data: {
      datasets: [
        {
          label: "Empirical mean of Sₙ/n",
          data: rows.map(row => ({
            x: row.n,
            y: row.average
          })),
          parsing: false,
          borderColor: COLORS.teal,
          backgroundColor: COLORS.teal,
          borderWidth: 2.5,
          pointRadius: 4,
          tension: 0.15
        },
        {
          label: "Theoretical expectation",
          data: [
            { x: sizes[0], y: theoreticalMean },
            { x: sizes[sizes.length - 1], y: theoreticalMean }
          ],
          parsing: false,
          borderColor: COLORS.orange,
          borderDash: [7, 5],
          borderWidth: 2.5,
          pointRadius: 0
        }
      ]
    },
    options: {
      ...lineOptions("Number of systems n", "Mean average score"),
      scales: {
        x: {
          type: "linear",
          title: {
            display: true,
            text: "Number of systems n"
          }
        },
        y: {
          title: {
            display: true,
            text: "Mean Sₙ/n across attackers"
          }
        }
      }
    }
  });

  const tbody = document.querySelector(
    "#comparisonTable tbody"
  );

  tbody.innerHTML = rows.map(row => `
    <tr>
      <td>${row.n}</td>
      <td>${fmt(row.average, 4)}</td>
      <td>${fmt(row.averageVariance, 6)}</td>
      <td>${fmt(row.normalizedVariance, 4)}</td>
    </tr>
  `).join("");
}

function updateMetrics(result, params) {
  const { n, p, model } = params;
  const mu = expectedValue(model, p);
  const v = incrementVariance(model, p);

  $("metricTotal").textContent =
    fmt(mean(result.totals), 3);

  $("metricAverage").textContent =
    fmt(mean(result.averages), 4);

  $("metricNormalized").textContent =
    fmt(mean(result.normalized), 3);

  $("metricVariance").textContent =
    fmt(variance(result.normalized), 4);

  $("metricTotalNote").textContent =
    `Theoretical mean: ${fmt(n * mu, 2)}`;

  $("metricAverageNote").textContent =
    `Expected: ${fmt(mu, 2)}`;

  $("metricVarianceNote").textContent =
    `Theoretical: ${fmt(v, 4)}`;
}

function runSimulation() {
  try {
    $("errorMessage").textContent = "";

    if (typeof Chart === "undefined") {
      throw new Error(
        "Chart.js could not load. Check your internet connection."
      );
    }

    const params = readParameters();

    const result = simulate(
      params.n,
      params.m,
      params.p,
      params.model
    );

    updateMetrics(result, params);
    drawTrajectories(result, params);
    drawDistributions(result);
    drawLLN(result, params);
    drawCLT(result, params);
    drawVariance(params);
    drawComparison(params);

  } catch (error) {
    $("errorMessage").textContent = error.message;
    console.error(error);
  }
}

runSimulation();
