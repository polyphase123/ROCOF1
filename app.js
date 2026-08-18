// ROCOF and Frequency Stability Simulation Logic

// Countries standards database with typical grid characteristics for superimposed simulations
const countryStandards = {
  custom: {
    name: "Custom Grid (Sliders)",
    flag: "⚙️",
    limit: 1.5,
    window: "User Defined",
    f0: 60,
    inertia: 4.0,
    damping: 1.0,
    droop: 5.0,
    govTime: 2.5,
    details: "Controlled manually using the grid parameter sliders to test custom grid scenarios.",
    color: "#0071e3",
    dash: []
  },
  philippines: {
    name: "Philippines (NGCP / PGC)",
    flag: "🇵🇭",
    limit: 1.0,
    window: "500ms",
    f0: 60,
    inertia: 3.0,
    damping: 1.0,
    droop: 5.0,
    govTime: 2.8,
    details: "Under the Philippine Grid Code (PGC), stability is critical across Luzon, Visayas, and Mindanao grids. As solar/wind and battery storage (BESS) integration increases, a 1.0 Hz/s ROCOF ride-through is standard for new generator interconnections.",
    color: "#ffcc00",
    dash: [4, 4]
  },
  ireland: {
    name: "Ireland (EirGrid)",
    flag: "🇮🇪",
    limit: 1.0,
    window: "500ms",
    f0: 50,
    inertia: 2.5,
    damping: 1.0,
    droop: 5.0,
    govTime: 3.0,
    details: "EirGrid increased the standard from 0.5 Hz/s to 1.0 Hz/s to allow wind power penetration to reach up to 75%+ instantaneous (SNSP). Older wind turbines had to be retrofitted to prevent tripping during minor frequency disturbances.",
    color: "#34c759",
    dash: [4, 4]
  },
  uk: {
    name: "Great Britain (National Grid)",
    flag: "🇬🇧",
    limit: 1.0,
    window: "500ms",
    f0: 50,
    inertia: 3.5,
    damping: 1.0,
    droop: 5.0,
    govTime: 2.5,
    details: "Under the G99 distribution code, generators must withstand a ROCOF of up to 1.0 Hz/s. This helps prevent widespread loss of distributed generation during frequency events.",
    color: "#5856d6",
    dash: [4, 4]
  },
  australia: {
    name: "Australia (AEMO)",
    flag: "🇦🇺",
    limit: 1.0,
    window: "1s (4Hz/s over 250ms)",
    f0: 50,
    inertia: 2.0,
    damping: 1.0,
    droop: 5.0,
    govTime: 2.0,
    details: "AEMO requires a minimum ride-through of 1.0 Hz/s over 1s, and a capability to withstand up to 4.0 Hz/s for 250ms due to high rooftop solar PV penetration and low physical inertia.",
    color: "#ff9500",
    dash: [4, 4]
  },
  europe: {
    name: "Continental Europe (ENTSO-E)",
    flag: "🇪🇺",
    limit: 2.0,
    window: "500ms",
    f0: 50,
    inertia: 5.0,
    damping: 1.5,
    droop: 5.0,
    govTime: 3.5,
    details: "ENTSO-E grid codes mandate that generators remain connected for ROCOF up to 2.0 Hz/s. This ensures resilience in the event of a system split (network separation).",
    color: "#af52de",
    dash: [4, 4]
  },
  usa: {
    name: "United States (IEEE 1547)",
    flag: "🇺🇸",
    limit: 3.0,
    window: "500ms",
    f0: 60,
    inertia: 4.5,
    damping: 1.5,
    droop: 5.0,
    govTime: 3.0,
    details: "IEEE 1547-2018 requires Distributed Energy Resources (DERs) like commercial solar and batteries to ride through ROCOF up to 3.0 Hz/s to prevent cascading utility trips.",
    color: "#ff3b30",
    dash: [4, 4]
  }
};

let currentCountry = "philippines";
let enabledSuperimpose = {
  custom: true,
  philippines: true,
  ireland: false,
  uk: false,
  australia: false,
  europe: false,
  usa: false
};

let chartInstance = null;

// Custom grid parameters (sliders)
let params = {
  f0: 60,
  inertia: 4.0,
  deficit: 0.08,
  damping: 1.0,
  droop: 5.0,
  govTime: 2.5
};

document.addEventListener("DOMContentLoaded", () => {
  initDOM();
  initChart();
  runSimulation();
});

function initDOM() {
  // Nominal frequency toggle
  document.querySelectorAll(".freq-toggle").forEach(btn => {
    btn.addEventListener("click", (e) => {
      document.querySelectorAll(".freq-toggle").forEach(b => b.classList.remove("active"));
      e.target.classList.add("active");
      params.f0 = parseInt(e.target.dataset.freq);
      document.getElementById("lbl-f0").textContent = params.f0 + " Hz";
      runSimulation();
    });
  });

  // Slider inputs
  setupSlider("inertia", (val) => { params.inertia = parseFloat(val); });
  setupSlider("deficit", (val) => { params.deficit = parseFloat(val) / 100; });
  setupSlider("damping", (val) => { params.damping = parseFloat(val); });

  // Country selector list
  const countryListContainer = document.querySelector(".country-list");
  countryListContainer.innerHTML = "";
  
  Object.keys(countryStandards).forEach(key => {
    if (key === "custom") return; // Don't list Custom Grid as a country standard selector
    
    const item = countryStandards[key];
    const div = document.createElement("div");
    div.className = `country-item ${key === currentCountry ? 'active' : ''}`;
    div.dataset.country = key;
    div.innerHTML = `
      <div class="country-info-header">
        <input type="checkbox" class="superimpose-cb" id="cb-${key}" ${enabledSuperimpose[key] ? 'checked' : ''} style="margin-right: 8px;">
        <span class="flag">${item.flag}</span>
        <span class="country-name">${item.name}</span>
      </div>
      <span class="country-limit">${item.limit} Hz/s</span>
    `;

    // Click handler to select and view details
    div.addEventListener("click", (e) => {
      if (e.target.type === "checkbox") return; // Handled separately
      document.querySelectorAll(".country-item").forEach(i => i.classList.remove("active"));
      div.classList.add("active");
      currentCountry = key;
      updateCountryDetails();
      evaluateSafety();
    });

    // Checkbox handler to toggle overlay waveform
    const cb = div.querySelector(".superimpose-cb");
    cb.addEventListener("change", (e) => {
      enabledSuperimpose[key] = e.target.checked;
      runSimulation();
    });

    countryListContainer.appendChild(div);
  });

  updateCountryDetails();
}

function setupSlider(id, updateFn) {
  const slider = document.getElementById(`slide-${id}`);
  const valDisp = document.getElementById(`val-${id}`);
  slider.addEventListener("input", (e) => {
    valDisp.textContent = e.target.value;
    updateFn(e.target.value);
    runSimulation();
  });
}

function updateCountryDetails() {
  const item = countryStandards[currentCountry];
  const detailsBox = document.getElementById("details-box");
  detailsBox.innerHTML = `
    <span class="details-tag" style="background-color: var(--accent-light); color: var(--accent);">
      LIMIT: ${item.limit} Hz/s (Window: ${item.window})
    </span>
    <p class="details-text">${item.details}</p>
  `;
}

function initChart() {
  const ctx = document.getElementById("simulationChart").getContext("2d");
  chartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: [],
      datasets: []
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          position: 'top',
          labels: {
            boxWidth: 12,
            font: { size: 10 }
          }
        },
        tooltip: {
          mode: 'index',
          intersect: false
        }
      },
      scales: {
        x: {
          type: 'linear',
          title: {
            display: true,
            text: 'Time (seconds)',
            font: { size: 11, weight: '600' }
          },
          grid: { color: '#f5f5f7' }
        },
        y: {
          type: 'linear',
          position: 'left',
          title: {
            display: true,
            text: 'Frequency deviation (Hz from Nominal)',
            font: { size: 11, weight: '600' }
          },
          grid: { color: '#f5f5f7' }
        }
      }
    }
  });
}

// Run frequency simulation for a given set of grid parameters
function simulateGrid(f0, inertia, deficit, damping, droop, govTime) {
  const dt = 0.02;
  const totalTime = 6;
  const steps = totalTime / dt;
  
  let t = 0;
  let f = f0;
  let Pgov = 0;
  const D = damping / 100;
  const R = droop / 100;
  const Tg = govTime;
  const H = inertia;
  const dP_load = deficit;

  let points = [];
  
  for (let i = 0; i <= steps; i++) {
    // Disturbance starts at t = 0.5s
    let current_dP = 0;
    if (t >= 0.5) {
      current_dP = dP_load;
    }
    
    const df = (f0 / (2 * H)) * (Pgov - current_dP - D * (f - f0));
    const error = (f0 - f) / (R * f0);
    const dPgov = (1 / Tg) * (error - Pgov);
    
    f += df * dt;
    Pgov += dPgov * dt;
    
    if (Pgov < 0) Pgov = 0;
    if (Pgov > 0.25) Pgov = 0.25;

    // Output frequency deviation (f - f0) to easily compare 50Hz and 60Hz systems superimposed!
    points.push({ x: t, y: f - f0 });
    t += dt;
  }
  
  return points;
}

function runSimulation() {
  const datasets = [];
  let minVal = 0;
  
  // 1. Simulate Custom Grid (always simulated if checked)
  if (enabledSuperimpose.custom) {
    const customPoints = simulateGrid(params.f0, params.inertia, params.deficit, params.damping, params.droop, params.govTime);
    datasets.push({
      label: "Custom Grid (Sliders)",
      data: customPoints,
      borderColor: countryStandards.custom.color,
      borderWidth: 2.5,
      pointRadius: 0,
      borderDash: countryStandards.custom.dash
    });
    
    // Find min nadir for custom grid to adjust axis
    customPoints.forEach(p => { if (p.y < minVal) minVal = p.y; });
    
    // Update live metrics on dashboard based on Custom Grid
    const peakRocof = (params.f0 * params.deficit) / (2 * params.inertia);
    const nadirVal = params.f0 + Math.min(...customPoints.map(p => p.y));
    document.getElementById("val-rocof").textContent = peakRocof.toFixed(3) + " Hz/s";
    document.getElementById("val-nadir").textContent = nadirVal.toFixed(3) + " Hz";
    
    evaluateSafety(peakRocof);
  }

  // 2. Simulate other checked countries
  Object.keys(countryStandards).forEach(key => {
    if (key === "custom") return;
    if (enabledSuperimpose[key]) {
      const c = countryStandards[key];
      // We simulate all countries responding to the SAME size deficit (params.deficit)
      // but using their typical inertia constants & nominal frequency
      const pts = simulateGrid(c.f0, c.inertia, params.deficit, c.damping, c.droop, c.govTime);
      datasets.push({
        label: `${c.flag} ${c.name}`,
        data: pts,
        borderColor: c.color,
        borderWidth: 2,
        pointRadius: 0,
        borderDash: c.dash
      });
      
      pts.forEach(p => { if (p.y < minVal) minVal = p.y; });
    }
  });

  // Update chart data
  chartInstance.data.datasets = datasets;
  chartInstance.options.scales.y.min = Math.floor((minVal - 0.2) * 5) / 5;
  chartInstance.options.scales.y.max = 0.2;
  chartInstance.update();
}

function evaluateSafety(peakRocof) {
  if (!peakRocof) {
    const H = params.inertia;
    const dP_load = params.deficit;
    peakRocof = (params.f0 * dP_load) / (2 * H);
  }
  
  const standard = countryStandards[currentCountry];
  const badge = document.getElementById("safety-badge");
  const margin = standard.limit - peakRocof;
  
  if (margin > 0.15) {
    badge.className = "status-badge safe";
    badge.innerHTML = `<span>🟢</span> Compliant: ROCOF is well below limit`;
  } else if (margin >= 0) {
    badge.className = "status-badge warning";
    badge.innerHTML = `<span>🟡</span> Warning: ROCOF is close to limit`;
  } else {
    badge.className = "status-badge danger";
    badge.innerHTML = `<span>🔴</span> Non-Compliant: ROCOF exceeds limit!`;
  }
}
