// Function to read from Chrome extension storage
function readFromStorage(key, callback) {
  chrome.storage.sync.get([key], callback);
}

// Function to write to Chrome extension storage
function writeToStorage(key, value, callback) {
  chrome.storage.sync.set({ key: value }, callback);
}

// Event handler for form submission
document
  .getElementById("api-key-form")
  .addEventListener("submit", function (event) {
    event.preventDefault();
    const apiKey = document.getElementById("api-key").value;
    const label = document.getElementById("outcome-label");
    if (apiKey) {
      ax_api(
        "code-execution/python/execute",
        { code: "print('Hello, Axiomatic!')" },
        apiKey
      ).then((response) => {
        console.log("API test response", response);
        if (response.is_success === true) {
          chrome.storage.sync.set({ ax_api_key: apiKey }, function () {
            console.log("API key saved");
            label.textContent = "API key tested and saved.";
            label.style.color = "#6eb700";
            document.body.style.cursor = "wait";
            setTimeout(() => {
              window.close();
            }, 3000);

          });
        } else {
          console.log("Error", response);
          label.textContent =
            "Error saving API key: invalid API key or server unavailable.";
            label.style.color = "darkred";
        }
        label.style.display = "block";

      });
    }
  });

// Load API key from storage on page load
window.onload = function () {
  readFromStorage("ax_api_key", function (items) {
    if (items.ax_api_key) {
      document.getElementById("api-key").value = items.ax_api_key;
      console.log("API key loaded from storage:", items.ax_api_key);
    }
  });
};

function ax_api(endpoint, args, api) {
  console.log("calling api", endpoint, args);
  return fetch(`https://api.axiomatic-ai.com/${endpoint}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": api,
    },
    body: JSON.stringify(args),
  })
    .then((response) => response.json())
    .then((data) => {
      console.log("API response", data);
      return data;
    })
    .catch((error) => {
      console.error("Error calling API:", error);
    });
}
