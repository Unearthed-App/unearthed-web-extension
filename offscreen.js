chrome.runtime.onMessage.addListener(async (message) => {
  if (message.type === "PARSE_HTML") {
    const parser = new DOMParser();
    const doc = parser.parseFromString(message.html, "text/html");

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

    chrome.runtime.sendMessage({ type: "PARSED_HTML", data: annotations });
  }
});
