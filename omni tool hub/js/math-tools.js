/* ==========================================================================
   OmniTool Kit - Math & Financial Utilities Script
   ========================================================================= */

// Global definitions for math helper wrapper functions (used in scientific calculator evaluation)
window.dSin = (x) => Math.sin((x * Math.PI) / 180);
window.dCos = (x) => Math.cos((x * Math.PI) / 180);
window.dTan = (x) => {
  // Handle tan(90) undefined check
  if ((x - 90) % 180 === 0) return NaN;
  return Math.tan((x * Math.PI) / 180);
};
window.dAsin = (x) => (Math.asin(x) * 180) / Math.PI;
window.dAcos = (x) => (Math.acos(x) * 180) / Math.PI;
window.dAtan = (x) => (Math.atan(x) * 180) / Math.PI;
window.fact = (x) => {
  if (x < 0) return NaN;
  if (x === 0 || x === 1) return 1;
  let res = 1;
  for (let i = 2; i <= x; i++) res *= i;
  return res;
};

document.addEventListener("DOMContentLoaded", () => {
  initScientificCalculator();
  initPercentageCalculator();
  initEmiCalculator();
  initGstCalculator();
});

/* ==========================================================================
   Tool 1: Scientific Calculator Engine
   ========================================================================== */
function initScientificCalculator() {
  const display = document.getElementById("calcDisplay");
  const formula = document.getElementById("calcFormula");
  const angleBtn = document.querySelector('[data-cmd="angle"]');
  const angleModeEl = document.getElementById("calcAngleMode");
  const shiftModeEl = document.getElementById("calcShiftMode");
  const historyList = document.getElementById("calcHistoryList");
  const clearHistoryBtn = document.getElementById("clearCalcHistoryBtn");
  
  let currentInput = "0";
  let equationString = ""; // Evaluatable representation (e.g. dSin(30))
  let displayString = "";  // UI formula representation (e.g. sin(30))
  let angleMode = "DEG";   // DEG or RAD
  let shiftActive = false;
  let calculationsHistory = [];

  // Restore history from storage
  const savedHist = localStorage.getItem("omnitool-calc-history");
  if (savedHist) {
    calculationsHistory = JSON.parse(savedHist);
    updateHistoryUi();
  }

  // Keyboard clicks
  document.querySelectorAll(".btn-calc").forEach(btn => {
    btn.addEventListener("click", () => {
      const val = btn.getAttribute("data-val");
      const cmd = btn.getAttribute("data-cmd");

      if (val) {
        handleDigit(val);
      } else if (cmd) {
        handleCommand(cmd);
      }
    });
  });

  // Keyboard press support
  window.addEventListener("keydown", (e) => {
    // Prevent interfering with search fields
    if (document.activeElement.tagName === "INPUT") return;

    if (e.key >= "0" && e.key <= "9") handleDigit(e.key);
    else if (e.key === ".") handleDigit(".");
    else if (e.key === "+") handleCommand("add");
    else if (e.key === "-") handleCommand("subtract");
    else if (e.key === "*") handleCommand("multiply");
    else if (e.key === "/") handleCommand("divide");
    else if (e.key === "Enter" || e.key === "=") handleCommand("equals");
    else if (e.key === "Backspace") handleCommand("backspace");
    else if (e.key === "Escape") handleCommand("clear");
  });

  function handleDigit(digit) {
    if (currentInput === "0" && digit !== ".") {
      currentInput = digit;
    } else {
      if (digit === "." && currentInput.includes(".")) return;
      currentInput += digit;
    }
    display.innerText = currentInput;
  }

  function handleCommand(cmd) {
    switch (cmd) {
      case "clear":
        currentInput = "0";
        equationString = "";
        displayString = "";
        formula.innerText = "";
        display.innerText = "0";
        break;
        
      case "backspace":
        if (currentInput.length > 1) {
          currentInput = currentInput.slice(0, -1);
        } else {
          currentInput = "0";
        }
        display.innerText = currentInput;
        break;

      case "angle":
        angleMode = angleMode === "DEG" ? "RAD" : "DEG";
        angleModeEl.innerText = angleMode;
        angleBtn.innerText = angleMode === "DEG" ? "Rad/Deg" : "Deg/Rad";
        window.showToast(`Switched angles to ${angleMode}`, "info");
        break;

      case "shift":
        shiftActive = !shiftActive;
        shiftModeEl.classList.toggle("hidden", !shiftActive);
        break;

      // Operator appends
      case "add": appendOperator(" + ", " + "); break;
      case "subtract": appendOperator(" - ", " - "); break;
      case "multiply": appendOperator(" × ", " * "); break;
      case "divide": appendOperator(" ÷ ", " / "); break;
      case "open-paren": appendOperator("(", "("); break;
      case "close-paren": appendOperator(")", ")"); break;

      // Constants
      case "const-pi":
        currentInput = "Math.PI";
        display.innerText = "π";
        break;
      case "const-e":
        currentInput = "Math.E";
        display.innerText = "e";
        break;

      // Direct functions on active inputs
      case "fact":
        if (currentInput) {
          const v = parseFloat(currentInput);
          if (isNaN(v)) return;
          const r = fact(v);
          currentInput = r.toString();
          display.innerText = currentInput;
        }
        break;
      case "inv":
        if (currentInput) {
          const v = parseFloat(currentInput);
          if (v === 0) {
            display.innerText = "Cannot divide by 0";
            return;
          }
          currentInput = (1 / v).toString();
          display.innerText = currentInput;
        }
        break;

      // Function appends
      case "sin": appendFunction("sin(", angleMode === "DEG" ? "dSin(" : "Math.sin("); break;
      case "cos": appendFunction("cos(", angleMode === "DEG" ? "dCos(" : "Math.cos("); break;
      case "tan": appendFunction("tan(", angleMode === "DEG" ? "dTan(" : "Math.tan("); break;
      case "sin-inv": appendFunction("asin(", angleMode === "DEG" ? "dAsin(" : "Math.asin("); break;
      case "cos-inv": appendFunction("acos(", angleMode === "DEG" ? "dAcos(" : "Math.acos("); break;
      case "tan-inv": appendFunction("atan(", angleMode === "DEG" ? "dAtan(" : "Math.atan("); break;
      
      case "sqrt": appendFunction("√(", "Math.sqrt("); break;
      case "ln": appendFunction("ln(", "Math.log("); break;
      case "log": appendFunction("log(", "Math.log10("); break;
      case "pow": appendOperator("^", "**"); break;
      case "exp": appendOperator("e", "*10^"); break;

      case "equals":
        evaluateEquation();
        break;
    }
  }

  function appendOperator(displayOp, equationOp) {
    if (currentInput === "Math.PI") {
      displayString += "π" + displayOp;
      equationString += "Math.PI" + equationOp;
    } else if (currentInput === "Math.E") {
      displayString += "e" + displayOp;
      equationString += "Math.E" + equationOp;
    } else {
      displayString += currentInput + displayOp;
      equationString += currentInput + equationOp;
    }
    
    currentInput = "0";
    formula.innerText = displayString;
    display.innerText = "0";
  }

  function appendFunction(displayFn, equationFn) {
    displayString += displayFn;
    equationString += equationFn;
    currentInput = "0";
    formula.innerText = displayString;
    display.innerText = "0";
  }

  function evaluateEquation() {
    let finalEquation = equationString;
    let finalDisplay = displayString;

    if (currentInput !== "0" && currentInput !== "") {
      if (currentInput === "Math.PI") {
        finalEquation += "Math.PI";
        finalDisplay += "π";
      } else if (currentInput === "Math.E") {
        finalEquation += "Math.E";
        finalDisplay += "e";
      } else {
        finalEquation += currentInput;
        finalDisplay += currentInput;
      }
    }

    // Auto-close parenthesis checks
    const openP = (finalEquation.match(/\(/g) || []).length;
    const closeP = (finalEquation.match(/\)/g) || []).length;
    if (openP > closeP) {
      finalEquation += ")".repeat(openP - closeP);
      finalDisplay += ")".repeat(openP - closeP);
    }

    try {
      if (finalEquation.trim() === "") return;
      
      // Perform safe eval
      const result = new Function(`return ${finalEquation}`)();
      
      if (isNaN(result) || !isFinite(result)) {
        display.innerText = "Calculation Error";
        return;
      }

      // Format output nicely
      const formattedResult = parseFloat(result.toFixed(10)).toString();
      display.innerText = formattedResult;
      formula.innerText = finalDisplay + " =";
      
      // Save history item
      calculationsHistory.unshift({
        expr: finalDisplay,
        res: formattedResult
      });
      if (calculationsHistory.length > 20) {
        calculationsHistory.pop();
      }
      
      localStorage.setItem("omnitool-calc-history", JSON.stringify(calculationsHistory));
      updateHistoryUi();

      // Reset states
      currentInput = formattedResult;
      equationString = "";
      displayString = "";
      shiftActive = false;
      shiftModeEl.classList.add("hidden");

    } catch (e) {
      display.innerText = "Syntax Error";
    }
  }

  function updateHistoryUi() {
    historyList.innerHTML = "";
    if (calculationsHistory.length === 0) {
      historyList.innerHTML = `<div class="no-history">No history yet</div>`;
      return;
    }

    calculationsHistory.forEach(item => {
      const div = document.createElement("div");
      div.className = "history-item";
      div.innerHTML = `
        <div class="hist-expr">${item.expr}</div>
        <div class="hist-res">${item.res}</div>
      `;

      div.addEventListener("click", () => {
        currentInput = item.res;
        display.innerText = currentInput;
        formula.innerText = item.expr;
      });

      historyList.appendChild(div);
    });
  }

  clearHistoryBtn.addEventListener("click", () => {
    calculationsHistory = [];
    localStorage.removeItem("omnitool-calc-history");
    updateHistoryUi();
    window.showToast("Calculation history deleted", "info");
  });
}

/* ==========================================================================
   Tool 2: Percentage Calculator
   ========================================================================== */
function initPercentageCalculator() {
  const p1 = document.getElementById("pctP1");
  const w1 = document.getElementById("pctW1");
  const ans1 = document.getElementById("pctAns1");

  const p2 = document.getElementById("pctP2");
  const w2 = document.getElementById("pctW2");
  const ans2 = document.getElementById("pctAns2");

  const p3 = document.getElementById("pctP3");
  const w3 = document.getElementById("pctW3");
  const ans3 = document.getElementById("pctAns3");

  const op4 = document.getElementById("pctOp4");
  const p4 = document.getElementById("pctP4");
  const w4 = document.getElementById("pctW4");
  const ans4 = document.getElementById("pctAns4");

  const calcPct1 = () => {
    const x = parseFloat(p1.value);
    const y = parseFloat(w1.value);
    if (!isNaN(x) && !isNaN(y)) {
      ans1.innerText = ((x / 100) * y).toFixed(4).replace(/\.?0+$/, "");
    } else {
      ans1.innerText = "-";
    }
  };

  const calcPct2 = () => {
    const x = parseFloat(p2.value);
    const y = parseFloat(w2.value);
    if (!isNaN(x) && !isNaN(y) && y !== 0) {
      ans2.innerText = ((x / y) * 100).toFixed(4).replace(/\.?0+$/, "") + "%";
    } else {
      ans2.innerText = "-";
    }
  };

  const calcPct3 = () => {
    const x = parseFloat(p3.value);
    const y = parseFloat(w3.value);
    if (!isNaN(x) && !isNaN(y) && x !== 0) {
      const diff = ((y - x) / x) * 100;
      const direction = diff >= 0 ? "Increase" : "Decrease";
      ans3.innerText = `${Math.abs(diff).toFixed(4).replace(/\.?0+$/, "")}% (${direction})`;
    } else {
      ans3.innerText = "-";
    }
  };

  const calcPct4 = () => {
    const x = parseFloat(p4.value);
    const y = parseFloat(w4.value);
    const op = op4.value;
    if (!isNaN(x) && !isNaN(y)) {
      const multiplier = op === "add" ? (1 + x / 100) : (1 - x / 100);
      ans4.innerText = (y * multiplier).toFixed(4).replace(/\.?0+$/, "");
    } else {
      ans4.innerText = "-";
    }
  };

  [p1, w1].forEach(input => input.addEventListener("input", calcPct1));
  [p2, w2].forEach(input => input.addEventListener("input", calcPct2));
  [p3, w3].forEach(input => input.addEventListener("input", calcPct3));
  [op4, p4, w4].forEach(input => input.addEventListener("input", calcPct4));
}

/* ==========================================================================
   Tool 3: Mortgage / Loan EMI Calculator
   ========================================================================== */
let emiChartInstance = null;

function initEmiCalculator() {
  const amountInput = document.getElementById("emiAmount");
  const rateInput = document.getElementById("emiRate");
  const tenureInput = document.getElementById("emiTenure");
  const unitSelect = document.getElementById("emiTenureUnit");

  const monthlyEmiEl = document.getElementById("emiValMonthly");
  const principalEl = document.getElementById("emiValPrincipal");
  const interestEl = document.getElementById("emiValInterest");
  const totalEl = document.getElementById("emiValTotal");

  const calculateEmi = () => {
    const P = parseFloat(amountInput.value);
    const annualRate = parseFloat(rateInput.value);
    const tenureVal = parseFloat(tenureInput.value);
    const unit = unitSelect.value;

    if (isNaN(P) || isNaN(annualRate) || isNaN(tenureVal) || P <= 0 || annualRate <= 0 || tenureVal <= 0) {
      return;
    }

    const n = unit === "years" ? tenureVal * 12 : tenureVal;
    const r = (annualRate / 12) / 100; // monthly rate fraction

    let emi = 0;
    if (r === 0) {
      emi = P / n;
    } else {
      // Standard Formula: E = P * r * (1+r)^n / ((1+r)^n - 1)
      emi = (P * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
    }

    const totalAmount = emi * n;
    const totalInterest = totalAmount - P;

    // Set text display
    monthlyEmiEl.innerText = formatCurrency(emi);
    principalEl.innerText = formatCurrency(P);
    interestEl.innerText = formatCurrency(totalInterest);
    totalEl.innerText = formatCurrency(totalAmount);

    updateChart(P, totalInterest);
  };

  function updateChart(principal, interest) {
    const ctx = document.getElementById("emiChart").getContext("2d");
    
    const isDark = document.documentElement.getAttribute("data-theme") === "dark";
    const textCol = isDark ? "#94a3b8" : "#475569";
    const gridCol = isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)";

    const chartData = {
      labels: ["Principal Amount", "Total Interest"],
      datasets: [{
        data: [principal, interest],
        backgroundColor: ["#6366f1", "#a855f7"],
        borderWidth: 1,
        borderColor: isDark ? "#151e33" : "#ffffff"
      }]
    };

    if (emiChartInstance) {
      emiChartInstance.data = chartData;
      emiChartInstance.options.plugins.legend.labels.color = textCol;
      emiChartInstance.update();
    } else {
      emiChartInstance = new Chart(ctx, {
        type: "doughnut",
        data: chartData,
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: "70%",
          plugins: {
            legend: {
              display: false // We use our own custom DOM legend
            },
            tooltip: {
              callbacks: {
                label: function(context) {
                  return ` ${context.label}: ${formatCurrency(context.raw)}`;
                }
              }
            }
          }
        }
      });
    }
  }

  function formatCurrency(num) {
    // Uses generic currency formatting
    return "$" + num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  // Bind change listeners to retrigger calculation
  [amountInput, rateInput, tenureInput, unitSelect].forEach(el => {
    el.addEventListener("input", calculateEmi);
  });

  // Assign functions globally to refresh alignments during view toggle routing
  window.updateEmiCalculations = calculateEmi;
  calculateEmi();
}

/* ==========================================================================
   Tool 4: GST Tax Calculator
   ========================================================================== */
function initGstCalculator() {
  const amountInput = document.getElementById("gstAmount");
  const countrySelect = document.getElementById("gstCountry");
  const rateInput = document.getElementById("gstRate");

  // Output DOM elements
  const addNet = document.getElementById("gstAddNet");
  const addTax = document.getElementById("gstAddTax");
  const addGross = document.getElementById("gstAddGross");

  const subGross = document.getElementById("gstSubGross");
  const subTax = document.getElementById("gstSubTax");
  const subNet = document.getElementById("gstSubNet");

  const calculateGst = () => {
    const base = parseFloat(amountInput.value);
    const rate = parseFloat(rateInput.value);

    if (isNaN(base) || isNaN(rate) || base <= 0 || rate < 0) {
      return;
    }

    // 1. ADD GST Computation
    const taxAdd = base * (rate / 100);
    const grossAdd = base + taxAdd;

    addNet.innerText = formatGstVal(base);
    addTax.innerText = formatGstVal(taxAdd);
    addGross.innerText = formatGstVal(grossAdd);

    // 2. REMOVE GST Computation
    // Gross = Net * (1 + rate/100) -> Net = Gross / (1 + rate/100)
    const netSub = base / (1 + rate / 100);
    const taxSub = base - netSub;

    subGross.innerText = formatGstVal(base);
    subTax.innerText = formatGstVal(taxSub);
    subNet.innerText = formatGstVal(netSub);
  };

  function formatGstVal(val) {
    return val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  // Country select changes standard rate preset values
  countrySelect.addEventListener("change", () => {
    const preset = countrySelect.value;
    if (preset === "custom") return;

    const rate = parseFloat(preset.split("-")[1]);
    rateInput.value = rate;
    calculateGst();
  });

  // Manual rate typing overrides select to "custom"
  rateInput.addEventListener("input", () => {
    countrySelect.value = "custom";
    calculateGst();
  });

  amountInput.addEventListener("input", calculateGst);
  
  // Start up compute call
  calculateGst();
}
