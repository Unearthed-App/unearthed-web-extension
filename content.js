chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "PARSE_HTML") {
    const parser = new DOMParser();
    const doc = parser.parseFromString(request.html, "text/html");

    const continuationTokenInput = doc.querySelector(
      ".kp-notebook-annotations-next-page-start"
    );
    const continuationToken = continuationTokenInput
      ? continuationTokenInput.value
      : null;

    const contentLimitStateInput = doc.querySelector(
      ".kp-notebook-content-limit-state"
    );
    const contentLimitState = contentLimitStateInput
      ? contentLimitStateInput.value
      : null;

    const annotations = [];

    const quotes = doc.querySelectorAll("#highlight");
    const note = doc.querySelectorAll("#note");
    const colorsAndLocations = doc.querySelectorAll(
      "#annotationHighlightHeader"
    );

    const length = Math.min(
      quotes.length,
      note.length,
      colorsAndLocations.length
    );

    for (let i = 0; i < length; i++) {
      annotations.push({
        quote: quotes[i].textContent?.trim() || "",
        note: note[i].textContent?.trim() || "",
        color: colorsAndLocations[i].textContent?.trim().split(" | ")[0] || "",
        location:
          colorsAndLocations[i].textContent?.trim().split(" | ")[1] || "",
      });
    }

    chrome.runtime.sendMessage({
      action: "PARSED_HTML",
      data: annotations,
      continuationToken,
      contentLimitState,
    });
  }
});
