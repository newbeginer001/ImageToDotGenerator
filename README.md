# Image to Dot Art Generator

A simple web application that converts uploaded images into ASCII/Unicode dot art text.

![screencapture-127-0-0-1-5500-index-html-2025-04-10-13_27_05 (1)](https://github.com/user-attachments/assets/4749c3cd-eb28-4166-9c9d-be13643d4ac8)
![screencapture-127-0-0-1-5500-index-html-2025-04-10-12_47_53](https://github.com/user-attachments/assets/982d56eb-2e5b-4ec6-b503-3552f2068ac5)



## Features

*   Upload an image (JPG, PNG, GIF, WEBP).
*   Adjust dot spacing, contrast, and brightness curve (gamma) for different effects.
*   Customize dot and background colors for the preview.
*   Automatically suggests settings based on image analysis.
*   Copy the generated dot art text to the clipboard.
*   Download the generated dot art as a `.txt` file.
*   Responsive design for different screen sizes.

## How to Use

1.  Open the `index.html` file in your web browser.
2.  Click the "Choose File" button or area to select an image from your device.
3.  The application will analyze the image and suggest initial settings.
4.  Adjust the sliders (Dot Spacing, Contrast, Brightness Curve) and color pickers (Dot Color, Background Color) to refine the output. The preview updates automatically (with a slight delay after slider changes).
5.  Once satisfied, click "Copy Text" to copy the result or "Download Text" to save it as a file.

## Development

*   **HTML:** `index.html` (Structure)
*   **CSS:** `css/style.css` (Styling)
*   **JavaScript:** `js/script.js` (Logic, DOM manipulation, image processing via Canvas)

---

Developed by Krishnendu Adhikary
