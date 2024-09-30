const domain = "https://unearthed.app";

let isLoggedIn = false;
let user = {};
let books = [];
let currentUrl = "";
let dailyReflection = {};

const allBooks = [];

document.addEventListener("DOMContentLoaded", function () {
  const dailyReflectionDiv = document.getElementById("dailyReflectionDiv");
  const dailyBookTitle = document.getElementById("dailyBookTitle");
  const dailyBookAuthor = document.getElementById("dailyBookAuthor");
  const dailyQuoteContent = document.getElementById("dailyQuoteContent");
  const dailyBookNotesDiv = document.getElementById("dailyBookNotesDiv");
  const dailyBookNotes = document.getElementById("dailyBookNotes");
  const dailyQuoteLocation = document.getElementById("dailyQuoteLocation");
  const dailyBookImg = document.getElementById("dailyBookImg");
  const dailyQuoteOuterContainer = document.getElementById(
    "dailyQuoteOuterContainer"
  );
  const dailyQuoteInnerContainer = document.getElementById(
    "dailyQuoteInnerContainer"
  );
  const loginToKindleDiv = document.getElementById("loginToKindleDiv");
  const loginToKindleButton = document.getElementById("loginToKindleButton");

  getBooksButton.addEventListener("click", () => {
    getBooksButton.disabled = true;
    getBooksButton.innerText = "Getting books...";
    chrome.tabs.create({ url: `${domain}/dashboard/home` }, function (tab) {
      chrome.tabs.onUpdated.addListener(function listener(tabId, changeInfo) {
        console.log("111");
        if (tabId === tab.id && changeInfo.status === "complete") {
          console.log("222");
          setTimeout(() => {
            if (isLoggedIn) {
              console.log("333");
              chrome.runtime.sendMessage({
                action: "GET_BOOKS",
              });
            } else {
              console.log("444");
              window.close();
            }
          }, 1000);
          chrome.tabs.onUpdated.removeListener(listener);
        }
      });
    });
  });
  const getBooksDiv = document.getElementById("getBooksDiv");

  const getNewQuoteButton = document.getElementById("getNewQuoteButton");
  getNewQuoteButton.addEventListener("click", function () {
    chrome.tabs.create({ url: `${domain}/dashboard/home` }, function (tab) {
      chrome.tabs.onUpdated.addListener(function listener(tabId, changeInfo) {
        if (tabId === tab.id && changeInfo.status === "complete") {
          window.close();
          chrome.tabs.onUpdated.removeListener(listener);
        }
      });
    });
  });

  loginToKindleButton.addEventListener("click", function () {
    chrome.tabs.create(
      { url: `https://read.amazon.com/notebook` },
      function (tab) {
        chrome.tabs.onUpdated.addListener(function listener(tabId, changeInfo) {
          if (tabId === tab.id && changeInfo.status === "complete") {
            window.close();
            chrome.tabs.onUpdated.removeListener(listener);
          }
        });
      }
    );
  });

  async function getDaily() {
    let data = {};
    try {
      const response = await fetch(`${domain}/api/get-daily`, {
        credentials: "include",
      });

      if (response.ok) {
        data = await response.json();
        dailyReflection = data.dailyReflection;
      } else {
        data = {};
      }
    } catch (error) {
      data = {};
    }

    updateUI();
  }

  setTimeout(getDaily, 1300);

  function updateUI() {
    if (dailyReflection.book) {
      dailyBookTitle.innerHTML = dailyReflection.book.title;
      dailyBookAuthor.innerHTML = `by: ${dailyReflection.book.author}`;
      dailyQuoteContent.innerHTML = dailyReflection.quote.content;

      dailyBookNotesDiv.style.display =
        dailyReflection.quote.note != "" ? "block" : "none";

      if (dailyReflection.quote.note != "") {
        dailyBookNotes.innerHTML = dailyReflection.quote.note;
      }

      dailyQuoteLocation.innerHTML = dailyReflection.quote.location;
      dailyBookImg.src = dailyReflection.book.imageUrl;

      dailyReflectionDiv.style.display = "block";

      dailyQuoteOuterContainer.style.borderColor =
        colorLookup[getColorKey(dailyReflection.quote.color)].borderColor;

      dailyQuoteOuterContainer.style.backgroundColor =
        colorLookup[getColorKey(dailyReflection.quote.color)].backgroundColor;

      dailyQuoteInnerContainer.style.borderColor =
        colorLookup[getColorKey(dailyReflection.quote.color)].borderColor;

      dailyQuoteInnerContainer.style.color =
        colorLookup[getColorKey(dailyReflection.quote.color)].color;
    }
  }

  const getColorKey = (colour) => {
    for (const key in colorLookup) {
      if (colour.toLowerCase().includes(key.toLowerCase())) {
        return key;
      }
    }

    return "grey";
  };

  const colorLookup = {
    grey: {
      borderColor: "#737373",
      color: "#171717",
      backgroundColor: "rgba(82, 82, 82, 0.1)",
    },
    yellow: {
      borderColor: "#eab308",
      color: "#713f12",
      backgroundColor: "rgba(202, 138, 4, 0.1)",
    },
    blue: {
      borderColor: "#3B82F6",
      color: "#1e3a8a",
      backgroundColor: "rgba(37, 99, 235, 0.1)",
    },
    pink: {
      borderColor: "#ec4899",
      color: "#831843",
      backgroundColor: "rgba(219, 39, 119, 0.1)",
    },
    orange: {
      borderColor: "#f97316",
      color: "#7c2d12",
      backgroundColor: "rgba(234, 88, 12, 0.1)",
    },
  };

  chrome.storage.local.get(["isLoggedIn"], (result) => {
    isLoggedIn = result.isLoggedIn || false;
    updateUI();

    if (!isLoggedIn) {
      chrome.tabs.create({ url: `${domain}/dashboard/home` }, function (tab) {
        chrome.tabs.onUpdated.addListener(function listener(tabId, changeInfo) {
          if (tabId === tab.id && changeInfo.status === "complete") {
            chrome.tabs.onUpdated.removeListener(listener);
          }
        });
      });

      setTimeout(() => {
        if (isLoggedIn) {
          chrome.tabs.query(
            { active: true, currentWindow: true },
            function (tabs) {
              chrome.tabs.remove(tabs[0].id);
            }
          );
        } else {
          window.close();
        }
      }, 1000);
    }
  });

  chrome.storage.onChanged.addListener((changes) => {
    if (changes.isLoggedIn) isLoggedIn = changes.isLoggedIn.newValue;
    updateUI();
  });

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log("chrome.runtime.onMessage");
    if (request.action === "GETTING_BOOKS_DONE") {
      // getBooksButton.disabled = true;
      getBooksButton.innerText = "Done!";

      chrome.tabs.create(
        { url: `${domain}/dashboard/books` },
        function (tab) {}
      );
    } else if (request.action === "GETTING_BOOKS_FAILED") {
      getBooksDiv.style.display = "none";
      loginToKindleDiv.style.display = "block";
      console.log("getting books failed");
    } else if (request.action === "PARSE_HTML") {
      console.log("...");
      parseBooks(request.html);
      sendResponse({ success: true, message: "HTML processed successfully" });
    } else if (request.action === "ADD_QUOTES_TO_BOOK") {
      parseQuotes(request.book.htmlId, request.html, request.lastBook);
      sendResponse({ success: true, message: "HTML processed successfully" });
    }
  });
});

const parseQuotes = async (bookHtmlId, quotesHtml, lastBook) => {
  const matchingBook = allBooks.find((book) => book.htmlId === bookHtmlId);

  const parser = new DOMParser();
  const doc = parser.parseFromString(quotesHtml, "text/html");

  const annotations = [];

  const quotes = doc.querySelectorAll("#highlight");
  const note = doc.querySelectorAll("#note");
  const colorsAndLocations = doc.querySelectorAll("#annotationHighlightHeader");

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
      location: colorsAndLocations[i].textContent?.trim().split(" | ")[1] || "",
    });
  }
  matchingBook.annotations = annotations;

  if (lastBook) {
    chrome.runtime.sendMessage({
      action: "UPLOAD_BOOKS",
      books: allBooks,
    });
  }
};

const parseBooks = (html) => {
  const parser = new DOMParser();
  const document = parser.parseFromString(html, "text/html");

  const booksHtml = document.querySelectorAll(
    "#kp-notebook-library .kp-notebook-library-each-book"
  );

  let booksFound = [];
  booksHtml.forEach((book, index) => {
    const link = book.querySelector("a.a-link-normal");
    const titleElement = book.querySelector("h2");
    const authorElement = book.querySelector("p");
    const imageElement = book.querySelector("img");
    if (link && titleElement && imageElement) {
      const bookTitle = titleElement.textContent?.trim() || "Untitled";
      const bookAuthor = authorElement.textContent?.trim() || "Unknown";
      const imageUrl = imageElement.src || "Unknown";

      booksFound.push({
        htmlId: book.id,
        title: bookTitle.split(": ")[0],
        subtitle: bookTitle.split(": ")[1],
        author: bookAuthor.replace(/^By: /, ""),
        imageUrl: imageUrl,
      });
      allBooks.push({
        htmlId: book.id,
        title: bookTitle.split(": ")[0],
        subtitle: bookTitle.split(": ")[1],
        author: bookAuthor.replace(/^By: /, ""),
        imageUrl: imageUrl,
      });
    }
  });

  if (booksFound.length > 0) {
    chrome.runtime.sendMessage({
      action: "GET_EACH_BOOK",
      booksFound: booksFound,
    });
  }
};
