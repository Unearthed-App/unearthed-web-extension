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

let fetchInProgress = false;

let allBooks = [];
chrome.tabs.onUpdated.addListener(function listener(tabId, changeInfo, tab) {
  if (changeInfo.status === "complete") {
    setTimeout(function () {
      checkLoginStatus();
      // Filter out non-webpage URLs like chrome://, edge://, about://, or new tab
      const url = tab.url;
      if (url && (url.startsWith("http://") || url.startsWith("https://"))) {
        if (fetchInProgress) {
          console.log("Fetch already in progress");
          return;
        }

        console.log(`Tab ${tabId} is a webpage and is fully loaded.`);
        const todaysDate = new Date().toISOString().slice(0, 10);

        chrome.cookies.get(
          {
            url: domain,
            name: "lastUplaodToUnearthed",
          },
          function (cookie) {
            if (!cookie || todaysDate != cookie.value) {
              fetchInProgress = true;
              fetchData(0, 3, null, [], true);

              chrome.cookies.set(
                {
                  url: domain,
                  name: "lastUplaodToUnearthed",
                  value: todaysDate,
                },
                function (cookie) {
                  console.log("Cookie set:", cookie);
                }
              );
            } else {
              console.log("Already got them today");
            }
          }
        );
      } else {
        console.log(
          `Script not injected as the tab ${tabId} is not a regular webpage.`
        );
      }
    }, 2000);
  }
});

async function fetchData(
  retries = 0,
  maxRetries = 3,
  paginationToken = null,
  accumulatedItems = [],
  runningInBackground = false
) {
  let urlToFetch =
    "https://read.amazon.com/kindle-library/search?libraryType=BOOKS&sortType=recency&querySize=50";
  if (paginationToken) {
    urlToFetch += `&paginationToken=${paginationToken}`;
  }

  try {
    const response = await fetch(urlToFetch, {
      credentials: "include",
      headers: {
        Accept: "*/*",
        "validation-token": "undefined",
        "Sec-Fetch-Dest": "empty",
        "Sec-Fetch-Mode": "cors",
        "Sec-Fetch-Site": "same-origin",
        Priority: "u=4",
      },
      referrer: "https://read.amazon.com/kindle-library",
      method: "GET",
      mode: "cors",
    });

    if (response.ok) {
      const res = await response.json();
      const itemsList = res.itemsList || [];
      accumulatedItems.push(...itemsList);

      if (res.paginationToken) {
        return await fetchData(
          0,
          maxRetries,
          res.paginationToken,
          accumulatedItems,
          runningInBackground
        );
      }

      parseBooks(accumulatedItems, runningInBackground);
    } else {
      console.error("Error fetching data 1:", response.statusText);
      if (retries < maxRetries) {
        console.log(`Retrying... Attempt ${retries + 1}/${maxRetries}`);
        return await fetchData(
          retries + 1,
          maxRetries,
          paginationToken,
          accumulatedItems,
          runningInBackground
        );
      } else {
        console.log("Max retries reached. Aborting.");
        sendGetBooksFailed();
      }
    }
  } catch (error) {
    console.error("Error fetching data 2:", error);
    if (retries < maxRetries) {
      console.log(`Retrying... Attempt ${retries + 1}/${maxRetries}`);
      return await fetchData(
        retries + 1,
        maxRetries,
        paginationToken,
        accumulatedItems,
        runningInBackground
      );
    } else {
      console.log("Max retries reached. Aborting.");
      sendGetBooksFailed();
    }
  }
}

function sendGetBooksFailed() {
  chrome.runtime.sendMessage({
    action: "GETTING_BOOKS_FAILED",
  });
}

async function checkLoginStatus() {
  let data = {};
  try {
    const response = await fetch(`${domain}/api/me`, {
      credentials: "include",
    });
    if (response.ok) {
      data = await response.json();
    } else {
      data = {};
    }
  } catch (error) {
    data = {};
  }

  chrome.storage.local.set({
    isLoggedIn: !!data.userId,
    isPremium: data.isPremium || false,
  });
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "GET_BOOKS") {
    fetchData();

    const todaysDate = new Date().toISOString().slice(0, 10);

    chrome.cookies.set(
      {
        url: domain,
        name: "lastUplaodToUnearthed",
        value: todaysDate,
        // value: "new Date().toISOString().slice(0, 10)",
      },
      function (cookie) {
        console.log("Cookie set:", cookie);
      }
    );
  }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "BOOKS_DATA") {
    chrome.runtime.sendMessage({ action: "SHOW_BOOKS", books: request.books });
  } else if (request.action === "UPLOAD_BOOKS") {
    bookUploadProcess(request.books);
  } else if (request.action === "GET_EACH_BOOK") {
    const ignoredBookTitles = request.ignoredBookTitles;

    allBooks = allBooks.filter((book) => {
      return ignoredBookTitles.includes(book.title);
    });

    if (allBooks.length > 0) {
      getEachBook();
    } else {
      chrome.runtime.sendMessage({
        action: "NO_BOOKS_SELECTED",
      });
    }
  }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {});

const bookUploadProcess = async (booksPassedIn) => {
  let updatedBooks = [];

  const booksToInsert = booksPassedIn.map((book) => ({
    title: book.title,
    subtitle: book.subtitle,
    author: book.author,
    imageUrl: book.imageUrl,
    asin: book.asin,
  }));
  let errorOccured = false;

  try {
    const response = await fetch(`${domain}/api/books-insert`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(booksToInsert),
    });

    if (!response.ok) {
      throw new Error("Error inserting");
    }
    const data = await response.json();

    const updatedBooksFromInserted = booksPassedIn
      .map((book) => {
        const matchingRecord = data.insertedRecords.find(
          (record) => record.title === book.title
        );
        if (matchingRecord) {
          return { ...book, id: matchingRecord.id };
        }
        return null;
      })
      .filter((book) => book !== null);

    const updatedBooksFromExisting = booksPassedIn
      .map((book) => {
        const matchingRecord = data.existingRecords.find(
          (record) => record.title === book.title
        );
        if (matchingRecord) {
          return { ...book, id: matchingRecord.id };
        }
        return null;
      })
      .filter((book) => book !== null);

    updatedBooks = [...updatedBooksFromInserted, ...updatedBooksFromExisting];
  } catch (error) {
    errorOccured = true;
    console.error(error);
  }

  const quotesToInsertArray = updatedBooks
    .map((book) =>
      book?.annotations?.map((annotation) => ({
        sourceId: book.id,
        content: annotation.quote,
        note: annotation.note,
        color: annotation.color,
        location: annotation.location,
      }))
    )
    .filter((x) => x !== undefined);

  const failedIndexes = [];

  for (let i = 0; i < quotesToInsertArray.length; i++) {
    try {
      const response = await fetch(`${domain}/api/quotes-insert`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(quotesToInsertArray[i]),
      });

      if (!response.ok) {
        throw new Error(`Error inserting quote at index ${i}`);
      }

      const data = await response.json();
    } catch (error) {
      errorOccured = true;
      console.error(`Failed to insert quote at index ${i}:`, error);
      failedIndexes.push(i);
    }
  }

  fetchInProgress = false;

  return !errorOccured;
};
const getEachBook = async (maxRetries = 3) => {
  await ensureOffscreen();

  for (const book of allBooks) {
    let retries = 0;
    let success = false;

    while (retries < maxRetries && !success) {
      try {
        const urlToFetch = `https://read.amazon.com/notebook?asin=${book.htmlId}&contentLimitState=&`;
        console.log("urlToFetch", urlToFetch);

        const response = await fetch(urlToFetch, {
          headers: {
            accept: "*/*",
            downlink: "10",
            dpr: "2",
            ect: "4g",
            priority: "u=1, i",
            rtt: "50",
            "sec-fetch-dest": "empty",
            "sec-fetch-mode": "cors",
            "sec-fetch-site": "same-origin",
            "x-requested-with": "XMLHttpRequest",
          },
          referrerPolicy: "strict-origin-when-cross-origin",
          body: null,
          method: "GET",
          mode: "cors",
          credentials: "include",
        });

        if (response.ok) {
          const html = await response.text();
          // const lastBook = allBooks.indexOf(book) === allBooks.length - 1;

          try {
            await parseSingleBook(book.htmlId, html);

            let bookSuccess = await uploadSingleBook(book);

            book.uploaded = bookSuccess;
            let booksUploaded = [];
            if (bookSuccess) {
              booksUploaded.push(book);
              chrome.runtime.sendMessage({
                action: "BOOKS_UPLOAD_SUCCESS",
                booksUploaded,
              });
            }
          } catch (error) {
            console.error("Error parsing HTML:", error);
          }

          success = true;
        } else {
          console.error(
            `Error fetching book ${book.htmlId}: ${response.statusText}`
          );
          throw new Error(response.statusText);
        }
      } catch (error) {
        console.error(error);
        retries++;
        console.error(
          `Retrying for book ${book.htmlId}... (${retries}/${maxRetries})`
        );

        if (retries === maxRetries) {
          console.error(
            `Failed to fetch book ${book.htmlId} after ${maxRetries} attempts.`
          );
        }
      }
    }
  }

  chrome.runtime.sendMessage({
    action: "FINISHED_UPLOAD",
    allBooks,
  });
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
    console.log("NEW ONE");
    if (runningInBackground) {
      allBooks = booksFound;
      getEachBook();
    } else {
      chrome.runtime.sendMessage({
        action: "PARSE_BOOKS_COMPLETE",
        booksFound: booksFound,
      });
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

async function parseSingleBook(htmlId, htmlContent) {
  let annotations = await new Promise((resolve) => {
    chrome.runtime.onMessage.addListener(function listener(message) {
      if (message.type === "PARSED_HTML") {
        chrome.runtime.onMessage.removeListener(listener);
        resolve(message.data);
      }
    });

    chrome.runtime.sendMessage({
      type: "PARSE_HTML",
      html: htmlContent,
    });
  });

  const book = allBooks.find((book) => book.htmlId === htmlId);
  if (book) {
    book.annotations = annotations;
  }
}

async function ensureOffscreen() {
  if (await chrome.offscreen.hasDocument()) {
    return;
  }

  await chrome.offscreen.createDocument({
    url: "offscreen.html",
    reasons: ["DOM_PARSER"],
    justification: "Parse HTML content in a headless environment",
  });
}

const uploadSingleBook = async (booksPassedIn) => {
  return await bookUploadProcess([booksPassedIn]);
};
