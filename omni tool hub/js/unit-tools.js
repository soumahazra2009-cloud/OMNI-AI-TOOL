/* ==========================================================================
   OmniTool Kit - Unit & Temperature Converter Script
   ========================================================================== */

const CONVERSION_METRICS = {
  length: {
    title: "Length Converter",
    base: "meter",
    units: [
      { id: "meter", label: "Meters (m)", factor: 1 },
      { id: "kilometer", label: "Kilometers (km)", factor: 1000 },
      { id: "centimeter", label: "Centimeters (cm)", factor: 0.01 },
      { id: "millimeter", label: "Millimeters (mm)", factor: 0.001 },
      { id: "mile", label: "Miles (mi)", factor: 1609.344 },
      { id: "yard", label: "Yards (yd)", factor: 0.9144 },
      { id: "foot", label: "Feet (ft)", factor: 0.3048 },
      { id: "inch", label: "Inches (in)", factor: 0.0254 }
    ]
  },
  weight: {
    title: "Weight & Mass Converter",
    base: "kilogram",
    units: [
      { id: "kilogram", label: "Kilograms (kg)", factor: 1 },
      { id: "gram", label: "Grams (g)", factor: 0.001 },
      { id: "milligram", label: "Milligrams (mg)", factor: 0.000001 },
      { id: "pound", label: "Pounds (lb)", factor: 0.45359237 },
      { id: "ounce", label: "Ounces (oz)", factor: 0.028349523125 }
    ]
  },
  area: {
    title: "Area Converter",
    base: "square_meter",
    units: [
      { id: "square_meter", label: "Square Meters (m²)", factor: 1 },
      { id: "square_kilometer", label: "Square Kilometers (km²)", factor: 1000000 },
      { id: "square_foot", label: "Square Feet (ft²)", factor: 0.09290304 },
      { id: "square_yard", label: "Square Yards (yd²)", factor: 0.83612736 },
      { id: "acre", label: "Acres", factor: 4046.8564224 },
      { id: "hectare", label: "Hectares", factor: 10000 }
    ]
  },
  volume: {
    title: "Volume Converter",
    base: "liter",
    units: [
      { id: "liter", label: "Liters (L)", factor: 1 },
      { id: "milliliter", label: "Milliliters (mL)", factor: 0.001 },
      { id: "gallon", label: "Gallons (US gal)", factor: 3.785411784 },
      { id: "quart", label: "Quarts (US qt)", factor: 0.946352946 },
      { id: "cup", label: "Cups (US cup)", factor: 0.236588236 }
    ]
  },
  temperature: {
    title: "Temperature Converter",
    base: "celsius",
    units: [
      { id: "celsius", label: "Celsius (°C)" },
      { id: "fahrenheit", label: "Fahrenheit (°F)" },
      { id: "kelvin", label: "Kelvin (K)" }
    ]
  }
};

document.addEventListener("DOMContentLoaded", () => {
  initUnitConverter();
});

function initUnitConverter() {
  const tabsContainer = document.getElementById("converterDimensionTabs");
  const grid = document.getElementById("converterGrid");
  const titleEl = document.getElementById("converterActiveTitle");

  let activeDimension = "length";

  // Re-build layout inputs based on selected tab
  function drawConverterGrid() {
    grid.innerHTML = "";
    
    const metric = CONVERSION_METRICS[activeDimension];
    titleEl.innerText = metric.title;

    metric.units.forEach(unit => {
      const group = document.createElement("div");
      group.className = "converter-group";
      group.innerHTML = `
        <label for="unit-${unit.id}">${unit.label}</label>
        <input type="number" id="unit-${unit.id}" class="converter-input" placeholder="Enter value">
      `;
      
      const input = group.querySelector("input");
      input.addEventListener("input", (e) => {
        handleConversion(unit.id, e.target.value);
      });

      grid.appendChild(group);
    });
  }

  // Handle live conversions on input changes
  function handleConversion(sourceId, rawValue) {
    const value = parseFloat(rawValue);
    const metric = CONVERSION_METRICS[activeDimension];

    // If blank or invalid, clear all other boxes
    if (isNaN(value)) {
      metric.units.forEach(unit => {
        if (unit.id !== sourceId) {
          document.getElementById(`unit-${unit.id}`).value = "";
        }
      });
      return;
    }

    let baseValue = 0; // Value normalized to metric base unit

    // 1. Calculate Base Unit representation
    if (activeDimension === "temperature") {
      // Temperature uses non-linear custom formula calculations
      if (sourceId === "celsius") {
        baseValue = value;
      } else if (sourceId === "fahrenheit") {
        baseValue = ((value - 32) * 5) / 9;
      } else if (sourceId === "kelvin") {
        baseValue = value - 273.15;
      }
    } else {
      // Standard metrics use simple multipliers
      const sourceUnitObj = metric.units.find(u => u.id === sourceId);
      baseValue = value * sourceUnitObj.factor;
    }

    // 2. Convert from Base Unit to all target boxes
    metric.units.forEach(targetUnit => {
      if (targetUnit.id === sourceId) return;

      const targetInput = document.getElementById(`unit-${targetUnit.id}`);
      let targetValue = 0;

      if (activeDimension === "temperature") {
        if (targetUnit.id === "celsius") {
          targetValue = baseValue;
        } else if (targetUnit.id === "fahrenheit") {
          targetValue = (baseValue * 9) / 5 + 32;
        } else if (targetUnit.id === "kelvin") {
          targetValue = baseValue + 273.15;
        }
      } else {
        targetValue = baseValue / targetUnit.factor;
      }

      // Format float output nicely to clean values (limit decimals to max 6)
      const cleanValue = parseFloat(targetValue.toFixed(6)).toString();
      targetInput.value = cleanValue;
    });
  }

  // Bind tab pill switching
  tabsContainer.querySelectorAll(".dim-pill").forEach(pill => {
    pill.addEventListener("click", () => {
      tabsContainer.querySelectorAll(".dim-pill").forEach(p => p.classList.remove("active"));
      pill.classList.add("active");
      activeDimension = pill.getAttribute("data-dim");
      drawConverterGrid();
    });
  });

  // Assign globally to bind with views
  window.drawConverterGrid = drawConverterGrid;
  
  // Initial draw
  drawConverterGrid();
}
