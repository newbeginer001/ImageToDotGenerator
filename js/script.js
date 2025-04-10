document.addEventListener("DOMContentLoaded", () => {
    // --- DOM Elements ---
    const imageLoader = document.getElementById("imageLoader"),
      dotSpacingSlider = document.getElementById("dotSpacing"),
      contrastSlider = document.getElementById("contrast"),
      brightnessCurveSlider = document.getElementById("brightnessCurve"),
      dotColorPicker = document.getElementById("dotColor"),
      bgColorPicker = document.getElementById("bgColor"),
      outputTextElement = document.getElementById("outputText"),
      statusDiv = document.getElementById("status"),
      copyTextButton = document.getElementById("copyTextButton"),
      downloadTextButton = document.getElementById("downloadTextButton"),
      mainCanvas = document.getElementById("imageCanvas"),
      mainCtx = mainCanvas.getContext("2d", { willReadFrequently: true }),
      analysisCanvas = document.getElementById("analysisCanvas"),
      analysisCtx = analysisCanvas.getContext("2d", { willReadFrequently: true });
  
    // --- State ---
    let originalImageDataURL = null,
      imageLoaded = false,
      isProcessing = false,
      debounceTimer;
  
    // --- Utilities ---
    const setStatus = (message, type = "info") => {
      let icon = type === "developer-credit" ? "" : (type === "error" ? "❌" : (type === "success" ? "✅" : "ℹ️")); // No default icon for credit
      statusDiv.innerHTML = `<span class="icon">${icon}</span> ${message}`;
      statusDiv.className = type; // Apply type as class
      console.log(`Status (${type}): ${message}`);
    };
  
    const updateOutputStyles = () => {
      const spacing = parseInt(dotSpacingSlider.value);
      outputTextElement.style.setProperty('--bg-color', bgColorPicker.value);
      outputTextElement.style.setProperty('--dot-color', dotColorPicker.value);
      const fontSize = Math.max(4, spacing * 1.8);
      outputTextElement.style.fontSize = `${fontSize}px`;
      outputTextElement.style.lineHeight = `${spacing}px`;
      outputTextElement.style.textAlign = "left";
    };
  
    const updateRangeDisplay = (element) => {
      const displaySpan = document.getElementById(element.id + "Value");
      if (displaySpan) {
        let suffix = (element.id === "dotSpacing") ? "px" : "%";
        displaySpan.textContent = element.value + suffix;
      }
    };
  
    const analyzeImage = (imageData) => {
      const data = imageData.data, width = imageData.width, height = imageData.height;
      let sumBrightness = 0, sumBrightnessSq = 0, pixelCount = 0, sampleStep = 5;
      for (let y = 0; y < height; y += sampleStep) {
        for (let x = 0; x < width; x += sampleStep) {
          const i = (y * width + x) * 4;
          const brightness = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]; // Luminosity
          sumBrightness += brightness; sumBrightnessSq += brightness * brightness; pixelCount++;
        }
      }
      if (pixelCount === 0) return { averageBrightness: 128, stdDevBrightness: 30 };
      const averageBrightness = sumBrightness / pixelCount;
      const variance = (sumBrightnessSq / pixelCount) - (averageBrightness * averageBrightness);
      const stdDevBrightness = Math.sqrt(Math.max(0, variance));
      return { averageBrightness, stdDevBrightness };
    };
  
    const suggestSettings = (analysis, imgWidth, imgHeight) => {
      const { averageBrightness, stdDevBrightness } = analysis;
      const sliderMinMax = (slider) => ({ min: parseInt(slider.min), max: parseInt(slider.max) });
      const clamp = (value, min, max) => Math.max(min, Math.min(max, Math.round(value)));
      const spacingRange = sliderMinMax(dotSpacingSlider), maxDim = Math.max(imgWidth, imgHeight);
      let suggestedSpacing = 5;
      if (maxDim > 1500) suggestedSpacing = 8; else if (maxDim > 800) suggestedSpacing = 6; else if (maxDim < 300) suggestedSpacing = 4;
      suggestedSpacing = clamp(suggestedSpacing, spacingRange.min, spacingRange.max);
      const contrastRange = sliderMinMax(contrastSlider), targetStdDev = 45, lowContrastThreshold = 25, highContrastThreshold = 65;
      let contrastAdjustmentFactor = 1.2;
      if (stdDevBrightness < lowContrastThreshold) contrastAdjustmentFactor = 1.8; else if (stdDevBrightness > highContrastThreshold) contrastAdjustmentFactor = 0.8;
      let suggestedContrast = 100 + (targetStdDev - stdDevBrightness) * contrastAdjustmentFactor;
      suggestedContrast = clamp(suggestedContrast, 50, 150); suggestedContrast = clamp(suggestedContrast, contrastRange.min, contrastRange.max);
      const gammaRange = sliderMinMax(brightnessCurveSlider), targetBrightness = 128;
      let gammaAdjustment = (targetBrightness - averageBrightness) * 0.7; let suggestedGamma = 100 + gammaAdjustment;
      suggestedGamma = clamp(suggestedGamma, 50, 200); suggestedGamma = clamp(suggestedGamma, gammaRange.min, gammaRange.max);
      console.log(`Analysis: Avg Brightness=${averageBrightness.toFixed(1)}, Std Dev=${stdDevBrightness.toFixed(1)} | Suggested: Spacing=${suggestedSpacing}, Contrast=${suggestedContrast}, Gamma=${suggestedGamma}`);
      return { suggestedSpacing, suggestedContrast, suggestedGamma };
    };
  
    const applySuggestedSettings = (settings) => {
      dotSpacingSlider.value = settings.suggestedSpacing; contrastSlider.value = settings.suggestedContrast; brightnessCurveSlider.value = settings.suggestedGamma;
      updateRangeDisplay(dotSpacingSlider); updateRangeDisplay(contrastSlider); updateRangeDisplay(brightnessCurveSlider);
      updateOutputStyles();
    };
  
    // --- Core Processing ---
    const processImage = () => {
      if (!imageLoaded || !originalImageDataURL) { if (!isProcessing) setStatus("Please load an image first.", "error"); return; }
      if (isProcessing) { console.log("Skip: Processing already in progress."); return; }
      isProcessing = true; setStatus("Processing image...", "info"); copyTextButton.disabled = true; downloadTextButton.disabled = true;
  
      requestAnimationFrame(() => {
        const dotSpacing = parseInt(dotSpacingSlider.value), contrast = parseInt(contrastSlider.value) / 100, gamma = parseInt(brightnessCurveSlider.value) / 100;
        const dotChar = "●", spaceChar = " ";
        const img = new Image();
        img.onload = () => {
          try {
            const MAX_DIMENSION = 1000; let scale = 1;
            if (img.width > MAX_DIMENSION || img.height > MAX_DIMENSION) { scale = Math.min(MAX_DIMENSION / img.width, MAX_DIMENSION / img.height); }
            scale = Math.min(scale, 60 / dotSpacing);
            const canvasWidth = Math.max(1, Math.floor(img.width * scale)), canvasHeight = Math.max(1, Math.floor(img.height * scale));
            mainCanvas.width = canvasWidth; mainCanvas.height = canvasHeight; mainCtx.drawImage(img, 0, 0, canvasWidth, canvasHeight);
            const imageData = mainCtx.getImageData(0, 0, canvasWidth, canvasHeight), data = imageData.data;
            let outputText = ""; const step = Math.max(1, Math.round(dotSpacing / scale));
            for (let y = 0; y < canvasHeight; y += step) {
              for (let x = 0; x < canvasWidth; x += step) {
                const idx = (y * canvasWidth + x) * 4; const r = data[idx], g = data[idx + 1], b = data[idx + 2];
                let brightness = 0.2126 * r + 0.7152 * g + 0.0722 * b;
                brightness = (brightness - 128) * contrast + 128; brightness = 255 * Math.pow(brightness / 255, gamma);
                brightness = Math.max(0, Math.min(255, brightness)); outputText += brightness < 128 ? dotChar : spaceChar;
              } outputText += "\n";
            }
            outputTextElement.textContent = outputText; updateOutputStyles();
  
            // Determine if settings were auto-adjusted for the status message
            const statusMsg = statusDiv.textContent.includes("Applying suggested settings") ? "Processing complete! (Auto settings applied)" : "Processing complete!";
            setStatus(statusMsg, "success"); // Show completion message first
            copyTextButton.disabled = false; downloadTextButton.disabled = false;
  
            // --- MODIFICATION: Show credit after delay ---
            setTimeout(() => {
              const creditMessage = `✨ Developed By <b>Krishnendu Adhikary</b> ✨`;
              setStatus(creditMessage, 'developer-credit'); // Use custom class type
            }, 1500); // 1.5 second delay
            // --- END MODIFICATION ---
  
          } catch (error) {
            console.error("Error during image processing:", error); setStatus(`Processing error: ${error.message}`, "error");
            copyTextButton.disabled = false; downloadTextButton.disabled = false;
          } finally { isProcessing = false; }
        };
        img.onerror = () => { setStatus("Error loading image data for processing.", "error"); isProcessing = false; copyTextButton.disabled = false; downloadTextButton.disabled = false; };
        img.src = originalImageDataURL;
      });
    };
    const debouncedProcessImage = () => { clearTimeout(debounceTimer); if (imageLoaded && !isProcessing) { debounceTimer = setTimeout(processImage, 300); } };
  
    // --- Event Listeners ---
    [dotSpacingSlider, contrastSlider, brightnessCurveSlider].forEach(el => { el.addEventListener("input", () => { updateRangeDisplay(el); updateOutputStyles(); debouncedProcessImage(); }); });
    [dotColorPicker, bgColorPicker].forEach(el => { el.addEventListener("input", () => { updateOutputStyles(); }); });
    imageLoader.addEventListener("change", (e) => {
      const file = e.target.files[0]; outputTextElement.textContent = ""; copyTextButton.disabled = true; downloadTextButton.disabled = true; imageLoaded = false; originalImageDataURL = null;
      if (!file) { setStatus("No file selected. Choose an image.", "info"); return; }
      if (!file.type.startsWith("image/")) { setStatus("Please select a valid image file (e.g., JPG, PNG, WEBP).", "error"); e.target.value = null; return; }
      setStatus("Loading image...", "info");
      const reader = new FileReader();
      reader.onload = (event) => {
        originalImageDataURL = event.target.result; const tempImg = new Image();
        tempImg.onload = () => {
          try {
            const analysisSize = 100; const aspect = tempImg.width / tempImg.height; let analysisW = analysisSize, analysisH = analysisSize;
            if (aspect > 1) analysisH = analysisSize / aspect; else analysisW = analysisSize * aspect;
            analysisCanvas.width = Math.max(1, Math.floor(analysisW)); analysisCanvas.height = Math.max(1, Math.floor(analysisH));
            analysisCtx.drawImage(tempImg, 0, 0, analysisCanvas.width, analysisCanvas.height);
            const analysisData = analysisCtx.getImageData(0, 0, analysisCanvas.width, analysisCanvas.height); const analysisResults = analyzeImage(analysisData);
            const suggested = suggestSettings(analysisResults, tempImg.width, tempImg.height);
            setStatus("Applying suggested settings...", "info"); applySuggestedSettings(suggested); imageLoaded = true; processImage();
          } catch (analysisError) { console.error("Error during image analysis:", analysisError); setStatus("Could not auto-adjust settings, using current.", "error"); imageLoaded = true; processImage(); }
        };
        tempImg.onerror = () => { setStatus("Error loading image for analysis.", "error"); }
        tempImg.src = event.target.result;
      };
      reader.onerror = (error) => { console.error("FileReader error:", error); setStatus("Error reading file.", "error"); };
      reader.readAsDataURL(file);
    });
    copyTextButton.addEventListener("click", async () => {
      if (!outputTextElement.textContent || copyTextButton.disabled) return;
      try { await navigator.clipboard.writeText(outputTextElement.textContent); setStatus("Text copied!", "success"); }
      catch (err) { console.error("Clipboard write error:", err); setStatus("Failed to copy.", "error"); }
    });
    downloadTextButton.addEventListener("click", () => {
      if (!outputTextElement.textContent || downloadTextButton.disabled) return;
      try { const blob = new Blob([outputTextElement.textContent], { type: "text/plain;charset=utf-8" }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; const originalFileName = imageLoader.files[0]?.name.split('.')[0] || 'dot-art'; a.download = `${originalFileName}_dots.txt`; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url); setStatus("Download started!", "success"); }
      catch (e) { console.error("Download error:", e); setStatus("Download failed.", "error"); }
    });
  
    // --- Initial Setup ---
    setStatus("Select an image to start.", "info"); updateOutputStyles();
    [dotSpacingSlider, contrastSlider, brightnessCurveSlider].forEach(updateRangeDisplay); outputTextElement.textContent = "";
  });