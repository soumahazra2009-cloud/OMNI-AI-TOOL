/* ==========================================================================
   OmniTool Kit Main JS - Routing, Search, Theme & Dashboard Manager
   ========================================================================== */

const TOOLS = [
  {
    id: "jpg-to-pdf",
    title: "JPG to PDF Converter",
    desc: "Convert multiple JPG, PNG, and WebP images into a single clean PDF document offline.",
    icon: "file-text",
    class: "pdf-glow",
    category: "images"
  },
  {
    id: "image-editor",
    title: "Image Editor & Resizer",
    desc: "Crop, rotate, resize, and apply professional adjustments to your pictures directly.",
    icon: "image",
    class: "editor-glow",
    category: "images"
  },
  {
    id: "image-compressor",
    title: "Format & Quality Compressor",
    desc: "Shrink image file size, adjust visual quality, and convert between JPEG, PNG, and WebP.",
    icon: "maximize-2",
    class: "compress-glow",
    category: "images"
  },
  {
    id: "scientific-calculator",
    title: "Scientific Calculator",
    desc: "Perform scientific calculations with angles, logs, powers, trigonometry, and constants.",
    icon: "calculator",
    class: "math-glow",
    category: "calculators"
  },
  {
    id: "percentage-calculator",
    title: "Percentage Calculator",
    desc: "Quickly compute percentage percentages, ratios, margins, add/subtract changes, and markups.",
    icon: "percent",
    class: "math-glow",
    category: "calculators"
  },
  {
    id: "emi-calculator",
    title: "Loan EMI Calculator",
    desc: "Calculate loan Equated Monthly Installment payments with detailed interest vs principal chart.",
    icon: "landmark",
    class: "math-glow",
    category: "calculators"
  },
  {
    id: "gst-calculator",
    title: "GST / VAT Calculator",
    desc: "Compute added or subtracted Goods and Services Taxes (GST/VAT) with country presets.",
    icon: "coins",
    class: "math-glow",
    category: "calculators"
  },
  {
    id: "unit-converter",
    title: "Unit & Temp Converter",
    desc: "Convert between various metrics for length, weight, area, volume, and temperature instantly.",
    icon: "arrow-left-right",
    class: "converter-glow",
    category: "converters"
  },
  {
    id: "8085-simulator",
    title: "8085 Processor Lab",
    desc: "Write assembly programs, load machine codes, step execution, and trace registers/RAM.",
    icon: "cpu",
    class: "converter-glow",
    category: "converters"
  }
];

document.addEventListener("DOMContentLoaded", () => {
  initTheme();
  initRouting();
  initDashboard();
  initMobileNavigation();
  
  // Re-run Lucide Icons to render elements
  lucide.createIcons();
});

/* ==========================================================================
   Routing System (SPA hash routing)
   ========================================================================== */
function initRouting() {
  const navigateToView = (viewId) => {
    // 1. Hide all views
    document.querySelectorAll(".view-section").forEach(view => {
      view.classList.remove("active");
    });
    
    // 2. Show active view
    const targetView = document.getElementById(`view-${viewId}`);
    if (targetView) {
      targetView.classList. Clark = "view-section active"; // safety override
      targetView.classList.add("active");
    }
    
    // 3. Update active sidebar item
    document.querySelectorAll(".nav-item").forEach(item => {
      item.classList.remove("active");
      if (item.getAttribute("data-view") === viewId) {
        item.classList.add("active");
      }
    });

    // 4. Scroll viewport back to top
    document.getElementById("viewport").scrollTop = 0;
    
    // 5. Hide search bar if not on dashboard
    const searchContainer = document.getElementById("globalSearchContainer");
    if (viewId === "dashboard") {
      searchContainer.style.opacity = "1";
      searchContainer.style.pointerEvents = "all";
    } else {
      searchContainer.style.opacity = "0.2";
      searchContainer.style.pointerEvents = "none";
    }
    
    // Trigger tool-specific initialization logic if required
    onViewActivated(viewId);
  };

  // Listen to Sidebar Link clicks
  document.querySelectorAll(".nav-item").forEach(link => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      const viewId = link.getAttribute("data-view");
      window.location.hash = viewId;
    });
  });

  // Listen to Back to Dashboard buttons
  document.querySelectorAll(".back-to-dashboard-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      window.location.hash = "dashboard";
    });
  });

  // Listen to Hash Changes
  window.addEventListener("hashchange", () => {
    let hash = window.location.hash.substring(1);
    if (!hash || !document.getElementById(`view-${hash}`)) {
      hash = "dashboard";
    }
    navigateToView(hash);
  });

  // Initial Route Check
  let initialHash = window.location.hash.substring(1);
  if (!initialHash || !document.getElementById(`view-${initialHash}`)) {
    initialHash = "dashboard";
  }
  navigateToView(initialHash);
}

// Hook called when a tool page is opened
function onViewActivated(viewId) {
  if (viewId === "emi-calculator") {
    // Recompute EMI to update Chart.js alignment (avoids render bug)
    if (typeof updateEmiCalculations === "function") {
      updateEmiCalculations();
    }
  } else if (viewId === "unit-converter") {
    // Redraw unit grid
    if (typeof drawConverterGrid === "function") {
      drawConverterGrid();
    }
  } else if (viewId === "8085-simulator") {
    // Initialize 8085 UI layout
    if (typeof update8085Ui === "function") {
      update8085Ui();
    }
  }
}

/* ==========================================================================
   Dashboard Manager (Filters & Search)
   ========================================================================== */
let activeCategory = "all";
let searchQuery = "";

function initDashboard() {
  const toolsGrid = document.getElementById("toolsGrid");
  const filterPills = document.querySelectorAll(".filter-pill");
  const searchInput = document.getElementById("globalSearch");

  // Render cards
  const renderDashboard = () => {
    toolsGrid.innerHTML = "";
    
    const filteredTools = TOOLS.filter(tool => {
      const matchCat = (activeCategory === "all" || tool.category === activeCategory);
      const matchQuery = tool.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         tool.desc.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         tool.category.toLowerCase().includes(searchQuery.toLowerCase());
      return matchCat && matchQuery;
    });

    if (filteredTools.length === 0) {
      toolsGrid.innerHTML = `
        <div class="glass flex-center" style="grid-column: 1/-1; padding: 40px; text-align: center; color: var(--text-secondary); width:100%; flex-direction:column; gap:12px;">
          <i data-lucide="search-code" style="width:36px; height:36px; stroke-width:1.5px; color: var(--text-muted);"></i>
          <div>No tools match your query "${searchQuery}"</div>
        </div>
      `;
      lucide.createIcons();
      return;
    }

    filteredTools.forEach(tool => {
      const card = document.createElement("a");
      card.href = `#${tool.id}`;
      card.className = "tool-card glass";
      card.innerHTML = `
        <div class="tool-card-icon ${tool.class}">
          <i data-lucide="${tool.icon}"></i>
        </div>
        <h3>${tool.title}</h3>
        <p>${tool.desc}</p>
        <div class="tool-card-footer">
          <span>Open Tool</span>
          <i data-lucide="arrow-right" style="width:16px; height:16px;"></i>
        </div>
      `;
      
      card.addEventListener("click", (e) => {
        e.preventDefault();
        window.location.hash = tool.id;
      });

      toolsGrid.appendChild(card);
    });

    lucide.createIcons();
  };

  // Category selection handler
  filterPills.forEach(pill => {
    pill.addEventListener("click", () => {
      filterPills.forEach(p => p.classList.remove("active"));
      pill.classList.add("active");
      activeCategory = pill.getAttribute("data-filter");
      renderDashboard();
    });
  });

  // Search input handler
  searchInput.addEventListener("input", (e) => {
    searchQuery = e.target.value;
    renderDashboard();
  });

  // Trigger initial paint
  renderDashboard();
}

/* ==========================================================================
   Theme Switcher (Dark / Light)
   ========================================================================== */
function initTheme() {
  const themeToggleBtn = document.getElementById("themeToggleBtn");
  const htmlEl = document.documentElement;

  // Retrieve saved theme
  const savedTheme = localStorage.getItem("omnitool-theme") || "dark";
  htmlEl.setAttribute("data-theme", savedTheme);

  themeToggleBtn.addEventListener("click", () => {
    const currentTheme = htmlEl.getAttribute("data-theme");
    const newTheme = currentTheme === "dark" ? "light" : "dark";
    htmlEl.setAttribute("data-theme", newTheme);
    localStorage.setItem("omnitool-theme", newTheme);
    showToast(`Switched to ${newTheme === "dark" ? "Dark Mode" : "Light Mode"}`, "info");
  });
}

/* ==========================================================================
   Mobile Responsive Navigation Sidebar
   ========================================================================== */
function initMobileNavigation() {
  const sidebar = document.getElementById("sidebar");
  const mobileToggleBtn = document.getElementById("mobileToggleBtn");
  const mobileCloseBtn = document.getElementById("mobileCloseBtn");

  mobileToggleBtn.addEventListener("click", () => {
    sidebar.classList.add("active");
  });

  mobileCloseBtn.addEventListener("click", () => {
    sidebar.classList.remove("active");
  });

  // Close sidebar on link click (in mobile)
  document.querySelectorAll(".nav-item").forEach(link => {
    link.addEventListener("click", () => {
      sidebar.classList.remove("active");
    });
  });
}

/* ==========================================================================
   Global Toast Notifications
   ========================================================================== */
let toastTimeout;
function showToast(message, type = "success") {
  const toast = document.getElementById("toastNotification");
  const toastMsg = document.getElementById("toastMessage");
  const toastIcon = toast.querySelector(".toast-icon");
  
  toastMsg.innerText = message;
  
  // Set class attributes based on type
  toast.className = `toast ${type}`;
  
  // Update icon matching type
  if (type === "success") {
    toastIcon.setAttribute("data-lucide", "check-circle-2");
  } else if (type === "error") {
    toastIcon.setAttribute("data-lucide", "alert-circle");
  } else {
    toastIcon.setAttribute("data-lucide", "info");
  }
  lucide.createIcons();

  toast.classList.remove("hidden");

  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    toast.classList.add("hidden");
  }, 3000);
}

// Attach toast function globally for other module scripts
window.showToast = showToast;
