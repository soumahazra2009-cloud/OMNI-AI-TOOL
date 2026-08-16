/* ==========================================================================
   OmniTool Kit - Image Utilities Script
   ========================================================================== */

document.addEventListener("DOMContentLoaded", () => {
  initJpgToPdf();
  initImageEditor();
  initImageCompressor();
});

/* ==========================================================================
   Tool 1: JPG to PDF Converter
   ========================================================================== */
function initJpgToPdf() {
  const dropZone = document.getElementById("pdfDropZone");
  const fileInput = document.getElementById("pdfFileInput");
  const previewContainer = document.getElementById("pdfPreviewContainer");
  const previewGrid = document.getElementById("pdfPreviewGrid");
  const generateBtn = document.getElementById("generatePdfBtn");
  const clearBtn = document.getElementById("clearPdfBtn");
  const imageCountText = document.getElementById("pdfImageCount");
  
  let pdfImages = []; // Stores objects: { id, file, name, dataUrl, width, height }
  let imageIdCounter = 0;

  // Click dropzone to trigger input
  dropZone.addEventListener("click", () => fileInput.click());

  // Handle file drops
  dropZone.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropZone.classList.add("dragover");
  });

  dropZone.addEventListener("dragleave", () => {
    dropZone.classList.remove("dragover");
  });

  dropZone.addEventListener("drop", (e) => {
    e.preventDefault();
    dropZone.classList.remove("dragover");
    if (e.dataTransfer.files.length > 0) {
      handlePdfFiles(e.dataTransfer.files);
    }
  });

  // Handle file select
  fileInput.addEventListener("change", (e) => {
    if (e.target.files.length > 0) {
      handlePdfFiles(e.target.files);
    }
  });

  function handlePdfFiles(files) {
    let loadedCount = 0;
    const totalFiles = files.length;
    
    Array.from(files).forEach(file => {
      // Validate image types
      if (!file.type.match("image/jpeg") && !file.type.match("image/png") && !file.type.match("image/webp")) {
        window.showToast("Unsupported file format! Upload JPG, PNG, or WebP.", "error");
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          pdfImages.push({
            id: imageIdCounter++,
            file: file,
            name: file.name,
            dataUrl: event.target.result,
            width: img.width,
            height: img.height
          });
          
          loadedCount++;
          if (loadedCount === totalFiles || pdfImages.length > 0) {
            updatePdfUi();
          }
        };
        img.src = event.target.result;
      };
      reader.readAsDataURL(file);
    });
  }

  function updatePdfUi() {
    previewGrid.innerHTML = "";
    imageCountText.innerText = pdfImages.length;

    if (pdfImages.length > 0) {
      dropZone.classList.add("hidden");
      previewContainer.classList.remove("hidden");
      generateBtn.classList.remove("disabled");
      generateBtn.removeAttribute("disabled");
      clearBtn.classList.remove("disabled");
      clearBtn.removeAttribute("disabled");
    } else {
      dropZone.classList.remove("hidden");
      previewContainer.classList.add("hidden");
      generateBtn.classList.add("disabled");
      generateBtn.setAttribute("disabled", "true");
      clearBtn.classList.add("disabled");
      clearBtn.setAttribute("disabled", "true");
    }

    pdfImages.forEach((imgObj, idx) => {
      const card = document.createElement("div");
      card.className = "preview-card";
      card.innerHTML = `
        <img src="${imgObj.dataUrl}" alt="${imgObj.name}">
        <div class="preview-card-overlay">
          <span class="card-num-badge">${idx + 1}</span>
          <div class="preview-card-actions">
            <div class="arrow-group">
              <button class="card-btn move-up" title="Move Left" ${idx === 0 ? 'disabled style="opacity:0.3"' : ''}>
                <i data-lucide="chevron-left" style="width:14px; height:14px;"></i>
              </button>
              <button class="card-btn move-down" title="Move Right" ${idx === pdfImages.length - 1 ? 'disabled style="opacity:0.3"' : ''}>
                <i data-lucide="chevron-right" style="width:14px; height:14px;"></i>
              </button>
            </div>
            <button class="card-btn del remove-img" title="Remove image">
              <i data-lucide="trash-2" style="width:14px; height:14px;"></i>
            </button>
          </div>
        </div>
      `;

      // Event listeners inside overlay
      card.querySelector(".move-up").addEventListener("click", (e) => {
        e.stopPropagation();
        if (idx > 0) {
          const temp = pdfImages[idx];
          pdfImages[idx] = pdfImages[idx - 1];
          pdfImages[idx - 1] = temp;
          updatePdfUi();
        }
      });

      card.querySelector(".move-down").addEventListener("click", (e) => {
        e.stopPropagation();
        if (idx < pdfImages.length - 1) {
          const temp = pdfImages[idx];
          pdfImages[idx] = pdfImages[idx + 1];
          pdfImages[idx + 1] = temp;
          updatePdfUi();
        }
      });

      card.querySelector(".remove-img").addEventListener("click", (e) => {
        e.stopPropagation();
        pdfImages.splice(idx, 1);
        updatePdfUi();
        window.showToast("Image removed", "info");
      });

      previewGrid.appendChild(card);
    });

    lucide.createIcons();
  }

  // Clear button action
  clearBtn.addEventListener("click", () => {
    pdfImages = [];
    fileInput.value = "";
    updatePdfUi();
    window.showToast("Cleared all uploaded files", "info");
  });

  // Generate PDF action
  generateBtn.addEventListener("click", () => {
    if (pdfImages.length === 0) return;

    const pageSize = document.getElementById("pdfPageSize").value; // a4, letter, fit
    const orientation = document.getElementById("pdfOrientation").value; // portrait, landscape
    const margin = parseInt(document.getElementById("pdfMargin").value, 10);

    const { jsPDF } = window.jspdf;
    let doc;

    pdfImages.forEach((imgObj, index) => {
      let width, height, pdfPageWidth, pdfPageHeight;
      const isPortrait = orientation === "portrait";

      if (pageSize === "fit") {
        pdfPageWidth = imgObj.width;
        pdfPageHeight = imgObj.height;
        doc = index === 0 
          ? new jsPDF({ orientation: imgObj.width > imgObj.height ? 'l' : 'p', unit: 'px', format: [pdfPageWidth, pdfPageHeight] })
          : (doc.addPage([pdfPageWidth, pdfPageHeight], imgObj.width > imgObj.height ? 'l' : 'p'), doc);
          
        width = pdfPageWidth - (margin * 2);
        height = pdfPageHeight - (margin * 2);
      } else {
        // A4 or Letter sizes
        // Standard sizing in mm: A4 = 210 x 297, Letter = 215.9 x 279.4
        if (pageSize === "a4") {
          pdfPageWidth = isPortrait ? 210 : 297;
          pdfPageHeight = isPortrait ? 297 : 210;
        } else {
          pdfPageWidth = isPortrait ? 215.9 : 279.4;
          pdfPageHeight = isPortrait ? 279.4 : 215.9;
        }

        doc = index === 0 
          ? new jsPDF({ orientation: orientation, unit: 'mm', format: pageSize })
          : (doc.addPage(pageSize, orientation), doc);

        const contentW = pdfPageWidth - (margin * 2);
        const contentH = pdfPageHeight - (margin * 2);
        
        // Scale image keeping proportions
        const imgRatio = imgObj.width / imgObj.height;
        const pageRatio = contentW / contentH;

        if (imgRatio > pageRatio) {
          width = contentW;
          height = contentW / imgRatio;
        } else {
          height = contentH;
          width = contentH * imgRatio;
        }
      }

      // Add image centered in coordinates
      const xOffset = margin + ((pdfPageWidth - (margin * 2) - width) / 2);
      const yOffset = margin + ((pdfPageHeight - (margin * 2) - height) / 2);

      const format = imgObj.name.toLowerCase().endsWith(".png") ? "PNG" : "JPEG";
      doc.addImage(imgObj.dataUrl, format, xOffset, yOffset, width, height, undefined, 'FAST');
    });

    doc.save("OmniToolKit_Export.pdf");
    window.showToast("PDF downloaded successfully!", "success");
  });
}

/* ==========================================================================
   Tool 2: Image Editor & Resizer
   ========================================================================== */
function initImageEditor() {
  const dropZone = document.getElementById("editorDropZone");
  const fileInput = document.getElementById("editorFileInput");
  const canvasWorkspace = document.getElementById("canvasWorkspace");
  const editorControls = document.getElementById("editorControls");
  
  const canvas = document.getElementById("editorCanvas");
  const ctx = canvas.getContext("2d");
  
  // Slider Controls
  const brightness = document.getElementById("sliderBrightness");
  const contrast = document.getElementById("sliderContrast");
  const saturation = document.getElementById("sliderSaturation");
  const blurVal = document.getElementById("sliderBlur");
  const grayscale = document.getElementById("sliderGrayscale");
  
  // Value badges
  const valBrightness = document.getElementById("valBrightness");
  const valContrast = document.getElementById("valContrast");
  const valSaturation = document.getElementById("valSaturation");
  const valBlur = document.getElementById("valBlur");
  const valGrayscale = document.getElementById("valGrayscale");

  // Transforms
  const rotateLeftBtn = document.getElementById("rotateLeftBtn");
  const rotateRightBtn = document.getElementById("rotateRightBtn");
  const flipHBtn = document.getElementById("flipHBtn");
  const flipVBtn = document.getElementById("flipVBtn");
  const resetBtn = document.getElementById("resetEditorBtn");
  const downloadBtn = document.getElementById("downloadEditedBtn");

  // Resize
  const editWidth = document.getElementById("editWidth");
  const editHeight = document.getElementById("editHeight");
  const editLockRatio = document.getElementById("editLockRatio");
  const applyResizeBtn = document.getElementById("applyResizeBtn");
  const metaInfo = document.getElementById("imageMetaInfo");

  // Crop controls
  const toggleCropBtn = document.getElementById("toggleCropBtn");
  const cropRatioSelection = document.getElementById("cropRatioSelection");
  const cropRatioSelect = document.getElementById("cropRatioSelect");
  const performCropBtn = document.getElementById("performCropBtn");
  const cropOverlay = document.getElementById("cropOverlay");
  const cropBox = document.getElementById("cropBox");

  let activeImage = null; // Original loaded Image HTML element
  let sourceCanvas = null; // Canvas storing currently modified base image
  
  let scaleX = 1;
  let scaleY = 1;
  let rotateDegrees = 0;

  let activeFilters = {
    brightness: 100,
    contrast: 100,
    saturation: 100,
    blur: 0,
    grayscale: 0
  };

  // Crop variables
  let isCroppingActive = false;
  let isDraggingBox = false;
  let isResizingBox = false;
  let activeResizeHandle = "";
  let dragStartOffset = { x: 0, y: 0 };
  let cropRect = { x: 0, y: 0, w: 0, h: 0 };

  // Set file select
  dropZone.addEventListener("click", () => fileInput.click());
  
  dropZone.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropZone.classList.add("dragover");
  });

  dropZone.addEventListener("dragleave", () => {
    dropZone.classList.remove("dragover");
  });

  dropZone.addEventListener("drop", (e) => {
    e.preventDefault();
    dropZone.classList.remove("dragover");
    if (e.dataTransfer.files.length > 0) {
      loadImage(e.dataTransfer.files[0]);
    }
  });

  fileInput.addEventListener("change", (e) => {
    if (e.target.files.length > 0) {
      loadImage(e.target.files[0]);
    }
  });

  function loadImage(file) {
    if (!file.type.startsWith("image/")) {
      window.showToast("Please upload an image file!", "error");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      activeImage = new Image();
      activeImage.onload = () => {
        // Create initial base canvas
        sourceCanvas = document.createElement("canvas");
        sourceCanvas.width = activeImage.naturalWidth;
        sourceCanvas.height = activeImage.naturalHeight;
        sourceCanvas.getContext("2d").drawImage(activeImage, 0, 0);

        // Prepopulate dimension forms
        editWidth.value = sourceCanvas.width;
        editHeight.value = sourceCanvas.height;

        // Reset variables
        resetState();

        // Switch panel visibility
        dropZone.classList.add("hidden");
        canvasWorkspace.classList.remove("hidden");
        editorControls.style.display = "flex";

        drawWorkspace();
        window.showToast("Image loaded successfully!", "success");
      };
      activeImage.src = event.target.result;
    };
    reader.readAsDataURL(file);
  }

  function resetState() {
    scaleX = 1;
    scaleY = 1;
    rotateDegrees = 0;
    activeFilters = { brightness: 100, contrast: 100, saturation: 100, blur: 0, grayscale: 0 };

    brightness.value = 100;
    contrast.value = 100;
    saturation.value = 100;
    blurVal.value = 0;
    grayscale.value = 0;

    valBrightness.innerText = "100%";
    valContrast.innerText = "100%";
    valSaturation.innerText = "100%";
    valBlur.innerText = "0px";
    valGrayscale.innerText = "0%";

    isCroppingActive = false;
    cropOverlay.classList.add("hidden");
    cropRatioSelection.classList.add("hidden");
    toggleCropBtn.classList.remove("primary");
  }

  function drawWorkspace() {
    if (!sourceCanvas) return;

    // Check if swap dimensions on rotate
    const isRotated90 = (rotateDegrees / 90) % 2 !== 0;
    const targetW = isRotated90 ? sourceCanvas.height : sourceCanvas.width;
    const targetH = isRotated90 ? sourceCanvas.width : sourceCanvas.height;

    canvas.width = targetW;
    canvas.height = targetH;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Save context
    ctx.save();
    
    // Move coordinate system to center
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((rotateDegrees * Math.PI) / 180);
    ctx.scale(scaleX, scaleY);
    
    // Apply filters
    ctx.filter = `
      brightness(${activeFilters.brightness}%)
      contrast(${activeFilters.contrast}%)
      saturate(${activeFilters.saturation}%)
      blur(${activeFilters.blur}px)
      grayscale(${activeFilters.grayscale}%)
    `;

    // Draw centered
    ctx.drawImage(sourceCanvas, -sourceCanvas.width / 2, -sourceCanvas.height / 2);
    ctx.restore();

    // Update metadata info
    metaInfo.innerText = `Original: ${activeImage.naturalWidth}x${activeImage.naturalHeight}px | Active Canvas: ${canvas.width}x${canvas.height}px`;
    
    // Align crop box overlays if active
    if (isCroppingActive) {
      updateCropBoxOverlay();
    }
  }

  // Handle slider events
  const onFilterChange = () => {
    activeFilters.brightness = brightness.value;
    activeFilters.contrast = contrast.value;
    activeFilters.saturation = saturation.value;
    activeFilters.blur = blurVal.value;
    activeFilters.grayscale = grayscale.value;

    valBrightness.innerText = `${brightness.value}%`;
    valContrast.innerText = `${contrast.value}%`;
    valSaturation.innerText = `${saturation.value}%`;
    valBlur.innerText = `${blurVal.value}px`;
    valGrayscale.innerText = `${grayscale.value}%`;

    drawWorkspace();
  };

  [brightness, contrast, saturation, blurVal, grayscale].forEach(slider => {
    slider.addEventListener("input", onFilterChange);
  });

  // Handle Transform Button clicks
  rotateLeftBtn.addEventListener("click", () => {
    rotateDegrees = (rotateDegrees - 90 + 360) % 360;
    drawWorkspace();
  });

  rotateRightBtn.addEventListener("click", () => {
    rotateDegrees = (rotateDegrees + 90) % 360;
    drawWorkspace();
  });

  flipHBtn.addEventListener("click", () => {
    scaleX = -scaleX;
    drawWorkspace();
  });

  flipVBtn.addEventListener("click", () => {
    scaleY = -scaleY;
    drawWorkspace();
  });

  // Aspect ratio resize bindings
  let lastWidth = 0;
  let lastHeight = 0;

  editWidth.addEventListener("input", () => {
    if (!sourceCanvas) return;
    if (editLockRatio.checked) {
      const ratio = sourceCanvas.height / sourceCanvas.width;
      editHeight.value = Math.round(editWidth.value * ratio);
    }
  });

  editHeight.addEventListener("input", () => {
    if (!sourceCanvas) return;
    if (editLockRatio.checked) {
      const ratio = sourceCanvas.width / sourceCanvas.height;
      editWidth.value = Math.round(editHeight.value * ratio);
    }
  });

  applyResizeBtn.addEventListener("click", () => {
    if (!sourceCanvas) return;
    const w = parseInt(editWidth.value, 10);
    const h = parseInt(editHeight.value, 10);

    if (isNaN(w) || isNaN(h) || w <= 0 || h <= 0) {
      window.showToast("Please input valid size dimension numbers!", "error");
      return;
    }

    // Resize sourceCanvas contents
    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = w;
    tempCanvas.height = h;
    
    // Draw scaled down representation
    const tempCtx = tempCanvas.getContext("2d");
    tempCtx.drawImage(sourceCanvas, 0, 0, w, h);
    
    sourceCanvas = tempCanvas;
    
    drawWorkspace();
    window.showToast(`Resized canvas to ${w}x${h}px`, "success");
  });

  // Reset ALL operations
  resetBtn.addEventListener("click", () => {
    if (!activeImage) return;
    
    sourceCanvas = document.createElement("canvas");
    sourceCanvas.width = activeImage.naturalWidth;
    sourceCanvas.height = activeImage.naturalHeight;
    sourceCanvas.getContext("2d").drawImage(activeImage, 0, 0);

    editWidth.value = sourceCanvas.width;
    editHeight.value = sourceCanvas.height;

    resetState();
    drawWorkspace();
    window.showToast("Reset all adjustments", "info");
  });

  // Download edited image file
  downloadBtn.addEventListener("click", () => {
    if (!canvas) return;
    
    const link = document.createElement("a");
    link.download = "OmniToolKit_Edit.png";
    link.href = canvas.toDataURL("image/png");
    link.click();
    window.showToast("Downloaded edited image!", "success");
  });

  /* ==========================================================================
     IMAGE CROPPING OVERLAY SYSTEM
     ========================================================================== */
  toggleCropBtn.addEventListener("click", () => {
    if (!sourceCanvas) return;
    
    isCroppingActive = !isCroppingActive;
    if (isCroppingActive) {
      cropOverlay.classList.remove("hidden");
      cropRatioSelection.classList.remove("hidden");
      toggleCropBtn.classList.add("primary");
      
      // Default crop boundaries
      const displayW = canvas.clientWidth;
      const displayH = canvas.clientHeight;
      
      cropRect.w = displayW * 0.7;
      cropRect.h = displayH * 0.7;
      cropRect.x = (displayW - cropRect.w) / 2;
      cropRect.y = (displayH - cropRect.h) / 2;
      
      updateCropBoxOverlay();
      window.showToast("Adjust crop boundary box and click 'Crop Selection'", "info");
    } else {
      cropOverlay.classList.add("hidden");
      cropRatioSelection.classList.add("hidden");
      toggleCropBtn.classList.remove("primary");
    }
  });

  cropRatioSelect.addEventListener("change", () => {
    applyCropBoxAspectConstraint();
  });

  function applyCropBoxAspectConstraint() {
    const ratioVal = cropRatioSelect.value;
    if (ratioVal === "free") return;

    let ratio = 1;
    if (ratioVal === "1:1") ratio = 1;
    else if (ratioVal === "16:9") ratio = 16 / 9;
    else if (ratioVal === "4:3") ratio = 4 / 3;

    cropRect.h = cropRect.w / ratio;
    
    // Bounds check
    const maxH = canvas.clientHeight - cropRect.y;
    if (cropRect.h > maxH) {
      cropRect.h = maxH;
      cropRect.w = cropRect.h * ratio;
    }
    
    updateCropBoxOverlay();
  }

  function updateCropBoxOverlay() {
    // Map bounds of actual DOM elements to align styling
    cropBox.style.left = `${cropRect.x}px`;
    cropBox.style.top = `${cropRect.y}px`;
    cropBox.style.width = `${cropRect.w}px`;
    cropBox.style.height = `${cropRect.h}px`;
  }

  // Box drag and resize implementation
  cropBox.addEventListener("mousedown", (e) => {
    if (e.target.classList.contains("crop-corner")) {
      isResizingBox = true;
      activeResizeHandle = e.target.classList[1];
    } else {
      isDraggingBox = true;
      dragStartOffset.x = e.clientX - cropRect.x;
      dragStartOffset.y = e.clientY - cropRect.y;
    }
  });

  window.addEventListener("mousemove", (e) => {
    if (!isCroppingActive) return;
    
    const wrapper = document.querySelector(".canvas-wrapper");
    const containerRect = wrapper.getBoundingClientRect();
    const activeCanvasRect = canvas.getBoundingClientRect();
    
    // Relative position coordinates inside displayed canvas space
    const mouseX = e.clientX - activeCanvasRect.left;
    const mouseY = e.clientY - activeCanvasRect.top;

    const displayW = activeCanvasRect.width;
    const displayH = activeCanvasRect.height;

    if (isDraggingBox) {
      let nx = e.clientX - activeCanvasRect.left - dragStartOffset.x;
      let ny = e.clientY - activeCanvasRect.top - dragStartOffset.y;

      // Limit in box boundaries
      nx = Math.max(0, Math.min(nx, displayW - cropRect.w));
      ny = Math.max(0, Math.min(ny, displayH - cropRect.h));

      cropRect.x = nx;
      cropRect.y = ny;
      updateCropBoxOverlay();
    } 
    else if (isResizingBox) {
      const minSize = 20;
      let nw = cropRect.w;
      let nh = cropRect.h;
      let nx = cropRect.x;
      let ny = cropRect.y;

      const ratioVal = cropRatioSelect.value;
      const isLocked = ratioVal !== "free";
      let ratio = 1;
      if (ratioVal === "1:1") ratio = 1;
      else if (ratioVal === "16:9") ratio = 16 / 9;
      else if (ratioVal === "4:3") ratio = 4 / 3;

      if (activeResizeHandle.includes("right")) {
        nw = Math.max(minSize, Math.min(mouseX - nx, displayW - nx));
      }
      if (activeResizeHandle.includes("bottom")) {
        nh = Math.max(minSize, Math.min(mouseY - ny, displayH - ny));
      }
      if (activeResizeHandle.includes("left")) {
        const rightEdge = nx + nw;
        nx = Math.max(0, Math.min(mouseX, rightEdge - minSize));
        nw = rightEdge - nx;
      }
      if (activeResizeHandle.includes("top")) {
        const bottomEdge = ny + nh;
        ny = Math.max(0, Math.min(mouseY, bottomEdge - minSize));
        nh = bottomEdge - ny;
      }

      if (isLocked) {
        if (activeResizeHandle.includes("right") || activeResizeHandle.includes("bottom")) {
          nh = nw / ratio;
          if (ny + nh > displayH) {
            nh = displayH - ny;
            nw = nh * ratio;
          }
        } else {
          nw = nh * ratio;
          if (nx + nw > displayW) {
            nw = displayW - nx;
            nh = nw / ratio;
          }
        }
      }

      cropRect.x = nx;
      cropRect.y = ny;
      cropRect.w = nw;
      cropRect.h = nh;
      updateCropBoxOverlay();
    }
  });

  window.addEventListener("mouseup", () => {
    isDraggingBox = false;
    isResizingBox = false;
  });

  // Process Crop Selection
  performCropBtn.addEventListener("click", () => {
    if (!sourceCanvas) return;

    // Convert display dimensions to real scale pixel indices on Active Canvas
    const displayW = canvas.clientWidth;
    const displayH = canvas.clientHeight;
    
    const scaleFactorX = canvas.width / displayW;
    const scaleFactorY = canvas.height / displayH;

    const realCropX = cropRect.x * scaleFactorX;
    const realCropY = cropRect.y * scaleFactorY;
    const realCropW = cropRect.w * scaleFactorX;
    const realCropH = cropRect.h * scaleFactorY;

    if (realCropW <= 0 || realCropH <= 0) {
      window.showToast("Invalid crop selection coordinates!", "error");
      return;
    }

    // Step 1: Create a canvas reflecting the cropped area of active canvas
    const croppedCanvas = document.createElement("canvas");
    croppedCanvas.width = realCropW;
    croppedCanvas.height = realCropH;
    
    const croppedCtx = croppedCanvas.getContext("2d");
    croppedCtx.drawImage(
      canvas, 
      realCropX, realCropY, realCropW, realCropH, 
      0, 0, realCropW, realCropH
    );

    // Step 2: Crop resets adjustments (applies current state permanently into a new sourceCanvas)
    sourceCanvas = croppedCanvas;
    editWidth.value = sourceCanvas.width;
    editHeight.value = sourceCanvas.height;

    resetState();
    drawWorkspace();

    window.showToast("Image cropped successfully!", "success");
  });
}

/* ==========================================================================
   Tool 3: Quality Compression & Format Converter
   ========================================================================== */
function initImageCompressor() {
  const dropZone = document.getElementById("compressorDropZone");
  const fileInput = document.getElementById("compressorFileInput");
  const statsContainer = document.getElementById("compressStatsContainer");
  
  const formatSelect = document.getElementById("compressFormat");
  const qualitySlider = document.getElementById("compressQuality");
  const qualityVal = document.getElementById("compressQualityVal");
  const qualitySliderGroup = document.getElementById("qualitySliderGroup");

  const origSizeBadge = document.getElementById("compOrigSize");
  const newSizeBadge = document.getElementById("compNewSize");
  const savingBadge = document.getElementById("compSavingPercent");

  const prevBefore = document.getElementById("compPrevBefore");
  const prevAfter = document.getElementById("compPrevAfter");

  const downloadBtn = document.getElementById("downloadCompressedBtn");
  const clearBtn = document.getElementById("clearCompressorBtn");

  let uploadedFile = null;
  let activeImageElement = null;
  let originalSizeOctets = 0;
  let compressedBlob = null;

  dropZone.addEventListener("click", () => fileInput.click());

  dropZone.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropZone.classList.add("dragover");
  });

  dropZone.addEventListener("dragleave", () => {
    dropZone.classList.remove("dragover");
  });

  dropZone.addEventListener("drop", (e) => {
    e.preventDefault();
    dropZone.classList.remove("dragover");
    if (e.dataTransfer.files.length > 0) {
      loadCompressImage(e.dataTransfer.files[0]);
    }
  });

  fileInput.addEventListener("change", (e) => {
    if (e.target.files.length > 0) {
      loadCompressImage(e.target.files[0]);
    }
  });

  function loadCompressImage(file) {
    if (!file.type.startsWith("image/")) {
      window.showToast("Please upload an image file format!", "error");
      return;
    }

    uploadedFile = file;
    originalSizeOctets = file.size;
    origSizeBadge.innerText = formatFileSize(file.size);

    const reader = new FileReader();
    reader.onload = (event) => {
      activeImageElement = new Image();
      activeImageElement.onload = () => {
        prevBefore.src = event.target.result;
        
        dropZone.classList.add("hidden");
        statsContainer.classList.remove("hidden");
        downloadBtn.classList.remove("disabled");
        downloadBtn.removeAttribute("disabled");
        clearBtn.classList.remove("disabled");
        clearBtn.removeAttribute("disabled");

        performCompression();
      };
      activeImageElement.src = event.target.result;
    };
    reader.readAsDataURL(file);
  }

  // Handle format toggle: Hide/Show quality slider for lossless PNG
  formatSelect.addEventListener("change", (e) => {
    if (e.target.value === "image/png") {
      qualitySliderGroup.style.opacity = "0.3";
      qualitySliderGroup.style.pointerEvents = "none";
    } else {
      qualitySliderGroup.style.opacity = "1";
      qualitySliderGroup.style.pointerEvents = "all";
    }
    performCompression();
  });

  // Slider change listeners
  qualitySlider.addEventListener("input", (e) => {
    qualityVal.innerText = `${e.target.value}%`;
  });

  qualitySlider.addEventListener("change", () => {
    performCompression();
  });

  function performCompression() {
    if (!activeImageElement) return;

    const mime = formatSelect.value;
    const quality = parseFloat(qualitySlider.value) / 100;

    // Create rendering canvas representation
    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = activeImageElement.naturalWidth;
    tempCanvas.height = activeImageElement.naturalHeight;

    const tempCtx = tempCanvas.getContext("2d");
    tempCtx.drawImage(activeImageElement, 0, 0);

    // Call native converter/compressor blob output
    tempCanvas.toBlob((blob) => {
      if (!blob) return;

      compressedBlob = blob;
      newSizeBadge.innerText = formatFileSize(blob.size);
      
      // Calculate savings
      const saving = originalSizeOctets - blob.size;
      const savingPct = Math.max(0, Math.round((saving / originalSizeOctets) * 100));
      
      savingBadge.innerText = saving >= 0 ? `Saved ${savingPct}%` : `Size +${Math.abs(savingPct)}%`;
      savingBadge.style.backgroundColor = saving >= 0 ? "var(--color-success)" : "var(--color-error)";

      // Build live preview
      const previewUrl = URL.createObjectURL(blob);
      prevAfter.src = previewUrl;

    }, mime, quality);
  }

  // Clear compressor page
  clearBtn.addEventListener("click", () => {
    uploadedFile = null;
    activeImageElement = null;
    compressedBlob = null;
    fileInput.value = "";

    dropZone.classList.remove("hidden");
    statsContainer.classList.add("hidden");
    downloadBtn.classList.add("disabled");
    downloadBtn.setAttribute("disabled", "true");
    clearBtn.classList.add("disabled");
    clearBtn.setAttribute("disabled", "true");
    
    window.showToast("Compressor cleared", "info");
  });

  // Download Compressed image file output
  downloadBtn.addEventListener("click", () => {
    if (!compressedBlob) return;

    const ext = formatSelect.value.split("/")[1];
    const link = document.createElement("a");
    link.href = URL.createObjectURL(compressedBlob);
    link.download = `OmniToolKit_Compressed.${ext === "jpeg" ? "jpg" : ext}`;
    link.click();
    
    window.showToast("Compressed image downloaded successfully!", "success");
  });

  function formatFileSize(bytes) {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  }
}
