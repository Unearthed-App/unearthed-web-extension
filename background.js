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

chrome.tabs.onUpdated.addListener(function listener(tabId, changeInfo, tab) {
  if (changeInfo.status === "complete") {
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
            fetchData();

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
  }
});

async function fetchData(
  retries = 0,
  maxRetries = 3,
  paginationToken = null,
  accumulatedItems = []
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
          accumulatedItems
        );
      }

      chrome.runtime.sendMessage({
        action: "PARSE_RESPONSE",
        itemsList: accumulatedItems,
      });
    } else {
      console.error("Error fetching data 1:", response.statusText);
      if (retries < maxRetries) {
        console.log(`Retrying... Attempt ${retries + 1}/${maxRetries}`);
        return await fetchData(
          retries + 1,
          maxRetries,
          paginationToken,
          accumulatedItems
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
        accumulatedItems
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
  console.log("onMessage", request.action);
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
    getEachBook(request.booksFound);
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

  if (!errorOccured) {
  }

  fetchInProgress = false;

  chrome.runtime.sendMessage({
    action: "GETTING_BOOKS_DONE",
  });
};
const getEachBook = async (booksFound, maxRetries = 3) => {
  for (const book of booksFound) {
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
          const lastBook = booksFound.indexOf(book) === booksFound.length - 1;

          chrome.runtime.sendMessage({
            action: "ADD_QUOTES_TO_BOOK",
            book: book,
            html: html,
            lastBook: lastBook,
          });

          success = true;
        } else {
          console.error(
            `Error fetching book ${book.htmlId}: ${response.statusText}`
          );
          throw new Error(response.statusText);
        }
      } catch (error) {
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
};
