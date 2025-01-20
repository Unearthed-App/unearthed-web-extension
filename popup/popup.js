/**
 * Copyright (C) 2024 Unearthed App
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

const domain = "https://unearthed.app";

let isLoggedIn = false;
let isPremium = false;
let user = {};
let books = [];
let currentUrl = "";
let dailyReflection = {};
let allBooks = [];
let booksForCsv = [];

document.addEventListener("DOMContentLoaded", function () {
  const loadingDailyReflection = document.getElementById(
    "loadingDailyReflection"
  );
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
  const getBooksButton = document.getElementById("getBooksButton");
  const getBooksInformationDiv = document.getElementById(
    "getBooksInformationDiv"
  );
  const getBooksInformation = document.getElementById("getBooksInformation");
  const getBooksDiv = document.getElementById("getBooksDiv");
  const getNewQuoteButton = document.getElementById("getNewQuoteButton");
  const continueGetBooks = document.getElementById("continueGetBooks");
  const downloadCsv = document.getElementById("downloadCsv");
  const deselectAll = document.getElementById("deselectAll");
  const selectAll = document.getElementById("selectAll");

  getBooksButton.addEventListener("click", () => {
    dailyReflectionDiv.style.display = "none";
    getBooksDiv.style.display = "none";
    getBooksInformationDiv.style.display = "block";
    getBooksInformation.innerText = "Getting books...";

    if (isLoggedIn) {
      chrome.runtime.sendMessage({
        action: "GET_BOOKS",
      });
    }
  });

  deselectAll.addEventListener("click", () => {
    const checkboxes = document.querySelectorAll(
      "#getBooksInformation input[type='checkbox']"
    );
    checkboxes.forEach((checkbox) => {
      checkbox.checked = false;
    });
  });

  selectAll.addEventListener("click", () => {
    const checkboxes = document.querySelectorAll(
      "#getBooksInformation input[type='checkbox']"
    );
    checkboxes.forEach((checkbox) => {
      checkbox.checked = true;
    });
  });

  continueGetBooks.addEventListener("click", () => {
    const ignoredBookTitles = Array.from(
      document.querySelectorAll(
        "#getBooksInformation input[type='checkbox']:checked"
      )
    ).map((checkbox) => checkbox.name);

    const booksToGet = allBooks.filter((book) => {
      return ignoredBookTitles.includes(book.title);
    });

    allBooks = allBooks.filter((book) => {
      return ignoredBookTitles.includes(book.title);
    });

    deselectAll.style.display = "none";
    selectAll.style.display = "none";
    continueGetBooks.style.display = "none";
    if (booksToGet.length > 0) {
      getBooksInformation.innerText = "Continuing...";
      chrome.runtime.sendMessage({
        action: "GET_EACH_BOOK",
        booksFound: booksToGet,
      });
    } else {
      getBooksInformation.innerText = "No books synced";
    }
  });

  downloadCsv.addEventListener("click", () => {
    const csv = convertBooksToCSV(booksForCsv);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "books.csv";
    link.click();
  });

  getNewQuoteButton.addEventListener("click", function () {
    chrome.tabs.create(
      {
        url: isPremium ? `${domain}/premium/home` : `${domain}/dashboard/home`,
      },
      function (tab) {
        chrome.tabs.onUpdated.addListener(function listener(tabId, changeInfo) {
          if (tabId === tab.id && changeInfo.status === "complete") {
            // window.close();
            chrome.tabs.onUpdated.removeListener(listener);
          }
        });
      }
    );
  });

  loginToKindleButton.addEventListener("click", function () {
    chrome.tabs.create(
      { url: `https://read.amazon.com/notebook` },
      function (tab) {
        chrome.tabs.onUpdated.addListener(function listener(tabId, changeInfo) {
          if (tabId === tab.id && changeInfo.status === "complete") {
            // window.close();
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
    if (!isLoggedIn) {
      loadingDailyReflection.style.display = "block";
      loadingDailyReflection.innerHTML = "Please login to Unearthed first.";
      getBooksDiv.style.display = "none";
    }
    if (dailyReflection.book) {
      loadingDailyReflection.style.display = "none";
      dailyBookTitle.innerHTML = dailyReflection.book.title;
      dailyBookAuthor.innerHTML = `by: ${dailyReflection.book.author}`;
      dailyQuoteContent.innerHTML = dailyReflection.quote.content;

      dailyBookNotesDiv.style.display =
        dailyReflection.quote.note != "" ? "block" : "none";

      if (dailyReflection.quote.note != "") {
        dailyBookNotes.innerHTML = dailyReflection.quote.note;
      }

      dailyQuoteLocation.innerHTML = dailyReflection.quote.location;

      dailyBookImg.style.display = dailyReflection.book.imageUrl
        ? "block"
        : "none";
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
    } else {
      loadingDailyReflection.style.display = "block";
    }
  }

  const getColorKey = (color) => {
    if (!color) return "grey";

    for (const key in colorLookup) {
      if (color.toLowerCase().includes(key.toLowerCase())) {
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

  chrome.storage.local.get(["isLoggedIn", "isPremium"], (result) => {
    isLoggedIn = result.isLoggedIn || false;
    isPremium = result.isPremium || false;
    updateUI();

    if (!isLoggedIn) {
      chrome.tabs.create(
        {
          url: isPremium
            ? `${domain}/premium/home`
            : `${domain}/dashboard/home`,
        },
        function (tab) {
          chrome.tabs.onUpdated.addListener(function listener(
            tabId,
            changeInfo
          ) {
            if (tabId === tab.id && changeInfo.status === "complete") {
              chrome.tabs.onUpdated.removeListener(listener);
            }
          });
        }
      );

      setTimeout(() => {
        if (isLoggedIn) {
          chrome.tabs.query(
            { active: true, currentWindow: true },
            function (tabs) {
              chrome.tabs.remove(tabs[0].id);
            }
          );
        } else {
          // window.close()
        }
      }, 1000);
    }
  });

  // Listen for changes in isLoggedIn and isPremium
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === "local") {
      if (changes.isLoggedIn) {
        isLoggedIn = changes.isLoggedIn.newValue;
        updateUI();
      }
      if (changes.isPremium) {
        isPremium = changes.isPremium.newValue;
      }
    }
  });

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log("chrome.runtime.onMessage");
    if (request.action === "GETTING_BOOKS_DONE") {
      getBooksInformation.innerText =
        "Complete, you will be able to view your books on unearthed.app soon.";
      downloadCsv.style.display = "block";

      // chrome.tabs.create(
      //   {
      //     url: isPremium
      //       ? `${domain}/premium/books`
      //       : `${domain}/dashboard/books`,
      //   },
      //   function (tab) {}
      // );
    } else if (request.action === "GETTING_BOOKS_FAILED") {
      getBooksDiv.style.display = "none";
      loginToKindleDiv.style.display = "block";
      console.log("getting books failed");
    } else if (request.action === "PARSE_RESPONSE") {
      parseBooks(request.itemsList, false);
      sendResponse({ success: true, message: "JSON processed successfully" });
    } else if (request.action === "PARSE_RESPONSE_BACKGROUND") {
      console.log("...");
      parseBooks(request.itemsList, true);
      sendResponse({ success: true, message: "JSON processed successfully" });
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

  getBooksInformation.innerText += `\n${matchingBook.title} has ${
    annotations.length
  } quote${annotations.length == 1 ? "" : "s"}...`;

  booksForCsv.push(matchingBook);

  if (lastBook) {
    chrome.runtime.sendMessage({
      action: "UPLOAD_BOOKS",
      books: allBooks,
    });
  }
};

const parseBooks = (itemsList, runningInBackground) => {
  if (!Array.isArray(itemsList)) {
    console.error("Invalid itemsList:", itemsList);
    return;
  }
  let booksFound = [];
  itemsList.forEach((book, index) => {
    const bookTitle = book.title?.trim() || "Untitled";
    const bookAuthor =
      book.authors && book.authors[0]
        ? formatAuthorName(book.authors[0])
        : "Unknown";
    const titleParts = bookTitle.split(": ");

    booksFound.push({
      htmlId: book.asin,
      title: titleParts[0],
      subtitle: titleParts[1] || "",
      author: bookAuthor,
      imageUrl: book.productUrl,
      asin: book.asin,
    });

    allBooks.push({
      htmlId: book.asin,
      title: titleParts[0],
      subtitle: titleParts[1] || "",
      author: bookAuthor,
      imageUrl: book.productUrl,
      asin: book.asin,
    });
  });

  if (booksFound.length > 0) {

    if (runningInBackground) {
      chrome.runtime.sendMessage({
        action: "GET_EACH_BOOK",
        booksFound: booksFound,
      });
    } else {
      getBooksInformation.innerText = `Found ${booksFound.length} books...`;
      const booksListElement = document.createElement("ul");
      booksListElement.classList.add("list-none");
      booksFound.forEach((book) => {
        const bookElement = document.createElement("li");
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.checked = true;
        checkbox.name = book.title;
        bookElement.appendChild(checkbox);
        const titleElement = document.createElement("span");
        titleElement.classList.add("ml-2");
        titleElement.textContent = book.title;
        bookElement.appendChild(titleElement);
        booksListElement.appendChild(bookElement);
      });
      getBooksInformation.appendChild(booksListElement);
    }
  }
};

function formatAuthorName(author) {
  if (author.endsWith(":")) {
    author = author.slice(0, -1);
  }
  const parts = author.split(",").map((part) => part.trim());
  if (parts.length === 2) {
    const [lastName, firstName] = parts;
    return `${firstName} ${lastName}`;
  } else {
    return author; // Return original name if format is unexpected
  }
}
function convertBooksToCSV(books) {
  let csv = [
    [
      "title",
      "subtitle",
      "author",
      "imageUrl",
      "asin",
      "content",
      "note",
      "color",
      "location",
    ],
  ];

  books.forEach((book) => {
    if (book.annotations.length > 0) {
      book.annotations.forEach((annotation) => {
        csv.push([
          book.title,
          book.subtitle,
          book.author,
          book.imageUrl,
          book.asin,
          annotation.quote,
          annotation.note,
          annotation.color,
          annotation.location,
        ]);
      });
    } else {
      // csv.push([
      //   book.title,
      //   book.subtitle,
      //   book.author,
      //   book.imageUrl,
      //   book.asin,
      //   "",
      //   "",
      //   "",
      //   "",
      // ]);
    }
  });

  return csv
    .map((row) =>
      row.map((cell) => `"${String(cell || "").replace(/"/g, '""')}"`).join(",")
    )
    .join("\n");
}
