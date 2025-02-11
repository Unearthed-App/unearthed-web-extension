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

let API_KEY = "";

let fetchInProgress = false;

let allBooks = [];
chrome.tabs.onUpdated.addListener(function listener(tabId, changeInfo, tab) {
  if (changeInfo.status === "complete") {
    setTimeout(function () {
      chrome.storage.local.get(["API_KEY"], function (result) {
        if (result.API_KEY) {
          API_KEY = result.API_KEY;
          // getMe();
        }
      });

      // Filter out non-webpage URLs like chrome://, edge://, about://, or new tab
      const url = tab.url;
      if (url && (url.startsWith("http://") || url.startsWith("https://"))) {
        chrome.scripting
          .executeScript({
            target: { tabId: tabId },
            files: ["content.js"],
          })
          .catch((err) => console.log("Injection failed:", err));

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
        `Script not injected as the tab ${tabId} is not a regular webpage.`;
      }
    }, 1000);
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

      await parseBooks(accumulatedItems, runningInBackground);
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

// async function getMe() {
//   if (!API_KEY) {
//     console.error("API_KEY is not defined. Unable to check login status.");
//     return;
//   }

//   let data = {};
//   try {
//     const response = await fetch(`${domain}/api/public/me`, {
//       credentials: "include",
//       headers: {
//         "Content-Type": "application/json",
//         Authorization: `Bearer ${API_KEY}`,
//       },
//     });
//     if (response.ok) {
//       data = await response.json();
//     } else {
//       data = {};
//     }
//   } catch (error) {
//     data = {};
//   }

//   chrome.storage.local.set({
//     // isLoggedIn: !!data.userId,
//     isPremium: data.isPremium || false,
//   });
// }

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "GET_BOOKS") {
    // chrome.tabs.create({ url: domain, active: false });

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
    if (fetchInProgress) {
      console.log("Fetch already in progress");
      chrome.runtime.sendMessage({
        action: "FETCH_IN_PROGRESS",
      });
      return;
    }
    const allowedBookTitles = request.allowedBookTitles;

    allBooks = allBooks.filter((book) => {
      return allowedBookTitles.includes(book.title);
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

const bookUploadProcess = async (booksPassedIn) => {
  if (!API_KEY) {
    console.error("API_KEY is not defined. Unable to check login status.");
    return;
  }

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
    const response = await fetch(`${domain}/api/public/books-insert`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${API_KEY}`,
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
      const response = await fetch(`${domain}/api/public/quotes-insert`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${API_KEY}`,
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

const getEachBook = async (maxRetries = 5) => {
  const retryDelays = [1000, 2000, 4000, 8000, 16000]; // Exponential backoff with jitter

  for (const book of allBooks) {
    let retries = 0;
    let success = false;
    let continuationToken = null;
    let contentLimitState = null;

    while (retries < maxRetries && !success) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      try {
        let urlToFetch;
        if (!continuationToken) {
          urlToFetch = `https://read.amazon.com/notebook?asin=${book.htmlId}&contentLimitState=&`;
        } else {
          urlToFetch = `https://read.amazon.com/notebook?asin=${
            book.htmlId
          }&token=${encodeURIComponent(
            continuationToken
          )}&contentLimitState=${encodeURIComponent(contentLimitState)}`;
        }

        console.log(
          "Processing:",
          book.htmlId,
          `(Attempt ${retries + 1}/${maxRetries})`
        );

        const response = await fetch(urlToFetch, {
          headers: {
            accept: "*/*",
            "x-requested-with": "XMLHttpRequest",
          },
          signal: controller.signal,
          referrerPolicy: "strict-origin-when-cross-origin",
          method: "GET",
          mode: "cors",
          credentials: "include",
        });

        if (response.status === 429) {
          const retryAfter =
            response.headers.get("Retry-After") ||
            Math.min(30, retryDelays[retries] + Math.random() * 1000);
          console.log(`Rate limited. Waiting ${Math.round(retryAfter)}ms`);
          await new Promise((resolve) => setTimeout(resolve, retryAfter));
          continue;
        }

        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const html = await response.text();
        const result = await parseSingleBook(book.htmlId, html);

        if (result) {
          continuationToken = result.continuationToken;
          contentLimitState = result.contentLimitState;

          if (!continuationToken) {
            const uploadSuccess = await uploadSingleBook(book);
            book.uploaded = uploadSuccess;
            if (uploadSuccess) {
              chrome.runtime.sendMessage({
                action: "BOOKS_UPLOAD_SUCCESS",
                booksUploaded: [book],
              });
              success = true;
            }
          } else {
            retries = -1;
          }
        }
      } catch (error) {
        console.error(
          `Attempt ${retries + 1} failed for ${book.htmlId}:`,
          error.message
        );
        if (++retries < maxRetries) {
          const delay = retryDelays[retries - 1] + Math.random() * 1000;
          console.log(`Waiting ${Math.round(delay)}ms before retry...`);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      } finally {
        clearTimeout(timeoutId);
        if (retries >= maxRetries && !success) {
          continuationToken = null;
          contentLimitState = null;
        }
      }

      if (continuationToken) {
        retries = 0;
        continue;
      }
    }

    if (!success) {
      book.uploaded = false;
      console.error(
        `Failed to process book ${book.htmlId} after ${maxRetries} attempts`
      );
    }
  }

  chrome.runtime.sendMessage({
    action: "FINISHED_UPLOAD",
    allBooks,
  });
};

const parseBooks = async (itemsList, runningInBackground) => {
  if (!Array.isArray(itemsList)) {
    console.error("Invalid itemsList:", itemsList);
    return;
  }
  itemsList.forEach((book, index) => {
    const bookTitle = book.title?.trim() || "Untitled";
    const bookAuthor =
      book.authors && book.authors[0]
        ? formatAuthorName(book.authors[0])
        : "Unknown";
    const titleParts = bookTitle.split(": ");

    allBooks.push({
      htmlId: book.asin,
      title: titleParts[0],
      subtitle: titleParts[1] || "",
      author: bookAuthor,
      imageUrl: book.productUrl,
      asin: book.asin,
    });
  });

  allBooks = allBooks.reduce((acc, book) => {
    const existingBook = acc.find((b) => b.htmlId === book.htmlId);
    if (existingBook) {
      console.log("FOUND EXISINTG BOOK", book);
      existingBook.title = book.title;
      existingBook.subtitle = book.subtitle;
      existingBook.author = book.author;
      existingBook.imageUrl = book.imageUrl;
      existingBook.asin = book.asin;
    } else {
      // console.log('FOUND EXISINTG BOOK', book);
      acc.push(book);
    }
    return acc;
  }, []);

  if (allBooks.length > 0) {
    if (runningInBackground) {
      // allBooks = booksFound;
      getEachBook();
    } else {
      chrome.runtime.sendMessage({
        action: "PARSE_BOOKS_COMPLETE",
        booksFound: allBooks,
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
  let parsingResult = await new Promise((resolve) => {
    chrome.runtime.onMessage.addListener(function listener(request) {
      if (request.action === "PARSED_HTML") {
        chrome.runtime.onMessage.removeListener(listener);
        resolve({
          annotations: request.data,
          continuationToken: request.continuationToken,
          contentLimitState: request.contentLimitState,
        });
      }
    });

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, {
          action: "PARSE_HTML",
          html: htmlContent,
        });
      }
    });
  });

  const book = allBooks.find((book) => book.htmlId === htmlId);
  if (book) {
    book.annotations = [
      ...(book.annotations || []),
      ...parsingResult.annotations,
    ];
    return parsingResult;
  }
  return null;
}

const uploadSingleBook = async (booksPassedIn) => {
  return await bookUploadProcess([booksPassedIn]);
};
