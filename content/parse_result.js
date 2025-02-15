// Listen for messages from the Chrome extension
console.log("Loaded", chrome);

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("Received message from background script:", request);
  if (request.message === "parse_plot") {
    // Handle the message and perform the parsing
    parseResult(request.image);
  }
  return true;
});

var blob;

// Function to parse the result
function parseResult(image) {

  // Create a data URL containing your HTML content
  var byteString = atob(image.split(",")[1]);
  var mimeString = image.split(",")[0].split(":")[1].split(";")[0];
  var ab = new ArrayBuffer(byteString.length);
  var ia = new Uint8Array(ab);
  for (var i = 0; i < byteString.length; i++) {
    ia[i] = byteString.charCodeAt(i);
  }
  var reqblob = new Blob([ab], { type: mimeString });
  var file = new File([reqblob], "image.png", { type: mimeString });

  const formData = new FormData();
  formData.append("plot_img", file);

  ax_api("document/plot/points", formData).then(async (response) => {
    const plotInfo = response.plot_info;
    const axesInfo = response.axes_info;
    // Get the canvas element and its 2D drawing context
    const canvas = document.createElement("canvas");
    canvas.backgroundImage = image;
    const ctx = canvas.getContext("2d");

    // Create a new image object
    async function getImageDimensions(file) {
      return new Promise(function (resolved, rejected) {
        var i = new Image();
        i.onload = function () {
          resolved({ width: i.width, height: i.height });
        };
        i.src = file;
      });
    }
    var imageDimensions = await getImageDimensions(image);
    canvas.width = imageDimensions.width;
    canvas.height = imageDimensions.height;

    const img = new Image();
    img.onload = function () {
      // Draw the image on the canvas at position (0, 0)
      ctx.drawImage(img, 0, 0);

      Object.entries(response.extracted_points.extracted_points).forEach(
        ([color, pointsObj]) => {
          const splitColor = color.split("_").slice(0, 3);
          const rgbColor = `rgb(${splitColor.join(",")})`;
          // Loop through each point in the points array
          Object.entries(pointsObj).forEach(([pId, point]) => {
            const x =
              (axesInfo.x_axis_len * (point.value_x - plotInfo.x_axis_min)) /
                (plotInfo.x_axis_max - plotInfo.x_axis_min) +
              axesInfo.origin[0];

            const y =
              axesInfo.origin[1] -
              (axesInfo.y_axis_len * (point.value_y - plotInfo.y_axis_min)) /
                (plotInfo.y_axis_max - plotInfo.y_axis_min);

            ctx.beginPath();
            ctx.arc(x, y, 4, 0, Math.PI * 2);
            ctx.fillStyle = rgbColor; // Fill color
            ctx.fill();
            ctx.strokeStyle = "#6EB700"; // Outline color
            ctx.stroke();
          });
        }
      );
      const canvasImg = document.querySelector(".ax-canvas");
      canvasImg.src = canvas.toDataURL("image/png");
    };
    img.onerror = function (e) {
      console.error("Error loading image", e);
    };
    img.src = image;

    const table = document.querySelector(".ax-table");
    // Clear the table before adding new rows
    table.innerHTML = "";

    // Create table headers
    const headerRow = table.insertRow();
    const headers = ["Point ID", "X Value", "Y Value", "Color"];
    headers.forEach((headerText) => {
      const headerCell = document.createElement("th");
      headerCell.textContent = headerText;
      headerRow.appendChild(headerCell);
    });

    // Create a dictionary to store points by color
    const pointsByColor = {};

    // Loop through each point and add it to the dictionary
    Object.entries(response.extracted_points.extracted_points).forEach(
      ([color, pointsObj]) => {
        pointsByColor[color] = [];
        Object.entries(pointsObj).forEach(([pId, point]) => {
          pointsByColor[color].push([point.value_x, point.value_y]);
        });
      }
    );
    const downloadButton = document.querySelector(".ax-download-button");
    downloadButton.download = "parse_result.json";
    blob = new Blob([JSON.stringify(pointsByColor)], {
      type: "application/json",
    });
    downloadButton.href = URL.createObjectURL(blob);

    // Loop through the dictionary and add rows to the table
    for (const [color, points] of Object.entries(pointsByColor)) {
      points.forEach((point, index) => {
        const row = table.insertRow();
        const splitColor = color.split("_").slice(0, 3);
        const rgbColor = `rgb(${splitColor.join(",")})`;

        const cellId = row.insertCell();
        cellId.textContent = index;

        const cellX = row.insertCell();
        cellX.textContent = point[0];

        const cellY = row.insertCell();
        cellY.textContent = point[1];

        const cellColor = row.insertCell();
        const colorLabel = document.createElement("span");
        colorLabel.style.backgroundColor = rgbColor;
        colorLabel.classList.add("color-label");
        cellColor.appendChild(colorLabel);
      });
    }
    const resultContainer = document.querySelector(".ax-result-container");
    resultContainer.style.display = "block";
    resultContainer.style.opacity = 1;
    document.querySelector(".ax-logo").style.display = "none";
  });
}

async function ax_api(endpoint, args) {
  var result;
  return new Promise((resolve, reject) => {
    chrome.storage.sync.get(["ax_api_key"], async (items) => {
      if (items.ax_api_key) {
        var res = fetch(`https://api.axiomatic-ai.com/${endpoint}`, {
          method: "POST",
          headers: {
            // 'Content-Type': 'application/json',
            "x-api-key": items.ax_api_key,
          },
          body: args,
        })
          .then((response) => response.json())
          .then((data) => {
            result = data;
            console.log("API response", data);
            return result;
          })
          .catch((error) => {
            console.error("Error calling API:", error);
            return null;
          });
        resolve(res);
      } else {
        chrome.runtime.openOptionsPage();
        window.close();
        result = null;
        reject("API key not found");
      }
    });
  });
}

// Prevent the page from being reloaded
window.addEventListener("beforeunload", function (event) {
  event.preventDefault();
  event.stopPropagation();
  return "Reloading the page will cause you to lose your work. Continue?";
});
