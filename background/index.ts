


import "@plasmohq/messaging/background";



import { startHub } from "@plasmohq/messaging/pub-sub";
import { Storage } from "@plasmohq/storage";





const parse5 = require("parse5")
const cssSelect = require("css-select")
const htmlparser2Adapter = require("parse5-htmlparser2-tree-adapter")


chrome.tabs.onUpdated.addListener(
  async function listener(tabId, changeInfo, tab) {
    if (changeInfo.status === "complete") {
            
      startHub()
      const storage = new Storage()

      const domain = "https://unearthed.app"

      const gotDate = await storage.get("gotDate")

      const storedAutoSync = await storage.get("autoSync")
      const autoSync = storedAutoSync

      const storedApiKey = await storage.get("API_KEY")
      const API_KEY = storedApiKey
      const storedSecret = await storage.get("secret")
      let secret = storedSecret
      let allBooks = []

      const today = new Date().toISOString().split("T")[0]

      if (gotDate == today || !API_KEY) {
        return
      }
      storage.set("gotDate", today)

      const bookUploadProcess = async (booksPassedIn) => {
        let updatedBooks = []
        const booksToInsert = booksPassedIn.map((book) => ({
          title: book.title,
          subtitle: book.subtitle,
          author: book.author,
          imageUrl: book.imageUrl,
          asin: book.asin
        }))
        let errorOccured = false

        try {
          const response = await fetch(`${domain}/api/public/books-insert`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${API_KEY}~~~${secret}`
            },
            body: JSON.stringify(booksToInsert)
          })

          if (!response.ok) {
            throw new Error("Error inserting")
          }
          const data = await response.json()

          const updatedBooksFromInserted = booksPassedIn
            .map((book) => {
              const matchingRecord = data.insertedRecords.find(
                (record) => record.title === book.title
              )
              if (matchingRecord) {
                return { ...book, id: matchingRecord.id }
              }
              return null
            })
            .filter((book) => book !== null)

          const updatedBooksFromExisting = booksPassedIn
            .map((book) => {
              const matchingRecord = data.existingRecords.find(
                (record) => record.title === book.title
              )
              if (matchingRecord) {
                return { ...book, id: matchingRecord.id }
              }
              return null
            })
            .filter((book) => book !== null)

          updatedBooks = [
            ...updatedBooksFromInserted,
            ...updatedBooksFromExisting
          ]
        } catch (error) {
          errorOccured = true
          console.error(error)
        }

        const quotesToInsertArray = updatedBooks
          .map((book) =>
            book?.annotations?.map((annotation) => ({
              sourceId: book.id,
              content: annotation.quote,
              note: annotation.note,
              color: annotation.color,
              location: annotation.location
            }))
          )
          .filter((x) => x !== undefined)

        const failedIndexes = []

        for (let i = 0; i < quotesToInsertArray.length; i++) {
          try {
            const response = await fetch(`${domain}/api/public/quotes-insert`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${API_KEY}~~~${secret}`
              },
              body: JSON.stringify(quotesToInsertArray[i])
            })

            if (!response.ok) {
              throw new Error(`Error inserting quote at index ${i}`)
            }
            await response.json()
          } catch (error) {
            errorOccured = true
            console.error(`Failed to insert quote at index ${i}:`, error)
            failedIndexes.push(i)
          }
        }
        return !errorOccured
      }

      const uploadSingleBook = async (bookPassedIn) => {
        return await bookUploadProcess([bookPassedIn])
      }

      const parseSingleBook = (htmlContent) => {
        const document = parse5.parse(htmlContent, {
          treeAdapter: htmlparser2Adapter
        })

        const continuationTokenInput = cssSelect.selectOne(
          ".kp-notebook-annotations-next-page-start",
          document
        )
        const continuationToken = continuationTokenInput
          ? continuationTokenInput.attribs.value
          : null

        const contentLimitStateInput = cssSelect.selectOne(
          ".kp-notebook-content-limit-state",
          document
        )
        const contentLimitState = contentLimitStateInput
          ? contentLimitStateInput.attribs.value
          : null

        const quotes = cssSelect.selectAll("#highlight", document)
        const notes = cssSelect.selectAll("#note", document)
        const colorsAndLocations = cssSelect.selectAll(
          "#annotationHighlightHeader",
          document
        )

        const length = Math.min(
          quotes.length,
          notes.length,
          colorsAndLocations.length
        )

        const getText = (node) => {
          let result = ""
          if (node.type === "text" && node.data) {
            result += node.data
          }
          if (node.children && node.children.length) {
            for (const child of node.children) {
              result += getText(child)
            }
          }
          return result
        }

        const annotations = []
        for (let i = 0; i < length; i++) {
          const quoteText = getText(quotes[i]).trim()
          const noteText = getText(notes[i]).trim()
          const colorAndLocationText = getText(colorsAndLocations[i]).trim()
          const [color = "", location = ""] = colorAndLocationText.split(" | ")

          annotations.push({
            quote: quoteText,
            note: noteText,
            color: color.trim(),
            location: location.trim()
          })
        }

        return {
          annotations,
          continuationToken,
          contentLimitState
        }
      }

      const getEachBook = async (booksToProcess, maxRetries = 1) => {
        const retryDelays = [1000, 2000, 4000, 8000, 16000]

        for (let book of booksToProcess) {
          let retries = 0
          let success = false
          let continuationToken = null
          let contentLimitState = null

          while (retries < maxRetries && !success) {
            const controller = new AbortController()
            const timeoutId = setTimeout(() => controller.abort(), 10000)

            try {
              let urlToFetch
              if (!continuationToken) {
                urlToFetch = `https://read.amazon.com/notebook?asin=${book.htmlId}&contentLimitState=&`
              } else {
                urlToFetch = `https://read.amazon.com/notebook?asin=${
                  book.htmlId
                }&token=${encodeURIComponent(
                  continuationToken
                )}&contentLimitState=${encodeURIComponent(contentLimitState)}`
              }

              console.log(
                "Processing:",
                book.htmlId,
                `(Attempt ${retries + 1}/${maxRetries})`
              )

              const response = await fetch(urlToFetch, {
                headers: {
                  accept: "*/*",
                  "x-requested-with": "XMLHttpRequest"
                },
                signal: controller.signal,
                referrerPolicy: "strict-origin-when-cross-origin",
                method: "GET",
                mode: "cors",
                credentials: "include"
              })

              if (response.status === 429) {
                const retryAfter =
                  response.headers.get("Retry-After") ||
                  Math.min(30, retryDelays[retries] + Math.random() * 1000)
                console.log(`Rate limited. Waiting ${Math.round(retryAfter)}ms`)
                await new Promise((resolve) => setTimeout(resolve, retryAfter))
                continue
              }

              if (!response.ok) throw new Error(`HTTP ${response.status}`)

              const html = await response.text()

              const result = await parseSingleBook(html)

              if (result) {
                continuationToken = result.continuationToken
                contentLimitState = result.contentLimitState
                if (book.annotations && Array.isArray(book.annotations)) {
                  book.annotations = [
                    ...book.annotations,
                    ...result.annotations
                  ]
                } else {
                  book.annotations = result.annotations
                }

                if (!continuationToken) {
                  console.log("Uploading:", book.htmlId)
                  const uploadSuccess = await uploadSingleBook(book)
                  book.uploaded = uploadSuccess
                  if (uploadSuccess) {
                    const booksUploaded = [book]
                    success = true
                  }
                } else {
                  retries = -1
                }
              }
            } catch (error) {
              console.error(
                `Attempt ${retries + 1} failed for ${book.htmlId}:`,
                error.message
              )
              if (++retries < maxRetries) {
                const delay = retryDelays[retries - 1] + Math.random() * 1000
                console.log(`Waiting ${Math.round(delay)}ms before retry...`)
                await new Promise((resolve) => setTimeout(resolve, delay))
              }
            } finally {
              clearTimeout(timeoutId)
              if (retries >= maxRetries && !success) {
                continuationToken = null
                contentLimitState = null
              }
            }

            if (continuationToken) {
              retries = 0
              continue
            }
          }

          if (!success) {
            book.uploaded = false
            console.error(
              `Failed to process book ${book.htmlId} after ${maxRetries} attempts`
            )
          }
        }

        let finishedHtml = "Done"
        let failedBooks = []
        let succeededBooks = []

        booksToProcess.forEach((book) => {
          if (book.uploaded) {
            succeededBooks.push(book)
          } else {
            failedBooks.push(book)
          }
        })

        if (failedBooks.length > 0) {
          finishedHtml += `\n${failedBooks.length} book${
            failedBooks.length > 1 ? "s" : ""
          } failed to upload`
        }
        failedBooks.forEach((book) => {
          finishedHtml += `\nFAILED: ${book.title}`
        })
        if (failedBooks.length > 0) {
          finishedHtml += `\n---`
        }

        if (succeededBooks.length > 0) {
          finishedHtml += `\n${succeededBooks.length} book${
            succeededBooks.length > 1 ? "s" : ""
          } uploaded`
        }
        succeededBooks.forEach((book) => {
          finishedHtml += `\nUploaded: ${book.title}`
        })
      }

      const formatAuthorName = (author) => {
        if (author.endsWith(":")) {
          author = author.slice(0, -1)
        }
        const parts = author.split(",").map((part) => part.trim())
        if (parts.length === 2) {
          const [lastName, firstName] = parts
          return `${firstName} ${lastName}`
        } else {
          return author
        }
      }

      const parseBooks = async (itemsList) => {
        if (!Array.isArray(itemsList)) {
          console.error("Invalid itemsList:", itemsList)
          return
        }
        allBooks = []
        itemsList.forEach((book, index) => {
          const bookTitle = book.title?.trim() || "Untitled"
          const bookAuthor =
            book.authors && book.authors[0]
              ? formatAuthorName(book.authors[0])
              : "Unknown"
          const titleParts = bookTitle.split(": ")

          allBooks.push({
            htmlId: book.asin,
            title: titleParts[0],
            subtitle: titleParts[1] || "",
            author: bookAuthor,
            imageUrl: book.productUrl,
            asin: book.asin
          })
        })
      }

      const fetchData = async (
        retries = 0,
        maxRetries = 3,
        paginationToken = null,
        accumulatedItems = []
      ) => {
        let urlToFetch =
          "https://read.amazon.com/kindle-library/search?libraryType=BOOKS&sortType=recency&querySize=50"
        if (paginationToken) {
          urlToFetch += `&paginationToken=${paginationToken}`
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
              Priority: "u=4"
            },
            referrer: "https://read.amazon.com/kindle-library",
            method: "GET",
            mode: "cors"
          })

          if (response.ok) {
            const res = await response.json()
            console.log("Response data:", res)
            const itemsList = res.itemsList || []
            accumulatedItems.push(...itemsList)

            if (res.paginationToken) {
              return await fetchData(
                0,
                maxRetries,
                res.paginationToken,
                accumulatedItems
              )
            }

            await parseBooks(accumulatedItems)
          } else {
            console.error("Error fetching data 1:", response.statusText)
            if (retries < maxRetries) {
              console.log(`Retrying... Attempt ${retries + 1}/${maxRetries}`)
              return await fetchData(
                retries + 1,
                maxRetries,
                paginationToken,
                accumulatedItems
              )
            } else {
              console.log("Max retries reached. Aborting.")
            }
          }
        } catch (error) {
          console.error("Error fetching data 2:", error)
          if (retries < maxRetries) {
            console.log(`Retrying... Attempt ${retries + 1}/${maxRetries}`)
            return await fetchData(
              retries + 1,
              maxRetries,
              paginationToken,
              accumulatedItems
            )
          } else {
            console.log("Max retries reached. Aborting.")
          }
        }
      }

      if (!secret) {
        const connectResults = await fetch(`${domain}/api/public/connect`, {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${API_KEY}`
          }
        })

        const connectData = await connectResults.json()

        secret = connectData.data.secret
        storage.set("secret", connectData.data.secret)
      }

      if (API_KEY && secret) {
        await fetchData()

        if (allBooks.length > 0) {
          getEachBook(allBooks)
        }
      }
    }
  }
)
