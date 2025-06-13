import React, { useCallback, useEffect, useState } from "react";



import { Storage } from "@plasmohq/storage";






import "./style.css";





// Utility function to sanitize text and handle problematic characters
const sanitizeText = (text: string): string => {
  if (!text || typeof text !== "string") return ""

  return (
    text
      // Normalize unicode characters
      .normalize("NFKC")
      // Replace various problematic quote characters with standard ones
      .replace(/[\u2018\u2019]/g, "'") // Smart single quotes
      .replace(/[\u201C\u201D]/g, '"') // Smart double quotes
      .replace(/[\u2013\u2014]/g, "-") // En dash, Em dash
      .replace(/\u2026/g, "...") // Ellipsis
      // Replace various whitespace characters with standard space
      .replace(/[\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]/g, " ")
      // Replace zero-width characters
      .replace(/[\u200B\u200C\u200D\uFEFF]/g, "")
      // Replace other problematic characters
      .replace(/[\u00AD]/g, "") // Soft hyphen
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "") // Control characters
      // Trim and collapse multiple spaces
      .replace(/\s+/g, " ")
      .trim()
  )
}

// import { sendToBackground } from "@plasmohq/messaging";

const domain = "https://unearthed.app"

const colorLookup = {
  grey: {
    borderColor: "#737373",
    color: "#171717",
    backgroundColor: "rgba(82, 82, 82, 0.1)"
  },
  yellow: {
    borderColor: "#eab308",
    color: "#713f12",
    backgroundColor: "rgba(202, 138, 4, 0.1)"
  },
  blue: {
    borderColor: "#3B82F6",
    color: "#1e3a8a",
    backgroundColor: "rgba(37, 99, 235, 0.1)"
  },
  pink: {
    borderColor: "#ec4899",
    color: "#831843",
    backgroundColor: "rgba(219, 39, 119, 0.1)"
  },
  orange: {
    borderColor: "#f97316",
    color: "#7c2d12",
    backgroundColor: "rgba(234, 88, 12, 0.1)"
  }
}

interface DailyReflection {
  source?: {
    title: string
    author: string
    imageUrl: string
  }
  quote?: {
    content: string
    note: string
    color: string
    location: string
  }
}

function IndexPopup() {
  const storage = new Storage()

  const [dailyReflection, setDailyReflection] = useState<DailyReflection>({})
  const [canConnect, setCanConnect] = useState(false)

  const [API_KEY, setAPI_KEY] = useState("")
  const [autoSync, setAutoSync] = useState(false)
  const [kindleURL, setKindleURL] = useState("read.amazon.com")
  const [loadingDailyReflectionVisible, setLoadingDailyReflectionVisible] =
    useState(true)
  const [syncing, setSyncing] = useState(false)
  const [finishedSyncing, setFinishedSyncing] = useState(false)
  const [loginToKindleDivVisible, setLoginToKindleDivVisible] = useState(false)
  const [settingsScreenVisible, setSettingsScreenVisible] = useState(false)
  const [getBooksInformationText, setGetBooksInformationText] =
    useState("Getting books...")
  const [allBooks, setAllBooks] = useState([])
  const [checkedBookTitles, setCheckedBookTitles] = useState([])
  const [secret, setSecret] = useState("")

  useEffect(() => {
    const loadApiKey = async () => {
      const storedApiKey = await storage.get("API_KEY")
      if (storedApiKey) {
        setAPI_KEY(storedApiKey)
      }
    }
    loadApiKey()
  }, [])

  useEffect(() => {
    const loadAutoSync = async () => {
      const storedAutoSync = await storage.get("autoSync")
      if (typeof storedAutoSync === "boolean") {
        setAutoSync(storedAutoSync)
      }
    }
    loadAutoSync()
  }, [])

  useEffect(() => {
    const loadKindleURL = async () => {
      const storedKindleURL = await storage.get("kindleURL")
      if (storedKindleURL) {
        setKindleURL(storedKindleURL)
      }
    }
    loadKindleURL()
  }, [])

  useEffect(() => {
    const loadApiKey = async () => {
      const storedSecret = await storage.get("secret")
      if (storedSecret) {
        setSecret(storedSecret)
      }
    }
    loadApiKey()
  }, [])

  useEffect(() => {
    if (API_KEY) {
      getDailyReflection()
    } else {
      setLoadingDailyReflectionVisible(false)
    }
  }, [API_KEY])

  const formatAuthorName = useCallback((author) => {
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
  }, [])

  const parseBooks = useCallback(
    async (itemsList) => {
      if (!Array.isArray(itemsList)) {
        console.error("Invalid itemsList:", itemsList)
        return
      }
      let newAllBooks = []
      itemsList.forEach((book, index) => {
        const rawBookTitle = book.title?.trim() || "Untitled"
        const bookTitle = sanitizeText(rawBookTitle)
        const rawBookAuthor =
          book.authors && book.authors[0]
            ? formatAuthorName(book.authors[0])
            : "Unknown"
        const bookAuthor = sanitizeText(rawBookAuthor)
        const titleParts = bookTitle.split(": ")

        newAllBooks.push({
          htmlId: book.asin,
          title: sanitizeText(titleParts[0]),
          subtitle: sanitizeText(titleParts[1] || ""),
          author: bookAuthor,
          imageUrl: book.productUrl,
          asin: book.asin
        })
      })

      newAllBooks = newAllBooks.reduce((acc, book) => {
        const existingBook = acc.find((b) => b.htmlId === book.htmlId)
        if (existingBook) {
          existingBook.title = book.title
          existingBook.subtitle = book.subtitle
          existingBook.author = book.author
          existingBook.imageUrl = book.imageUrl
          existingBook.asin = book.asin
        } else {
          acc.push(book)
        }
        return acc
      }, [])

      const allTitles = newAllBooks.map((book) => book.title)
      setCheckedBookTitles(allTitles)

      if (newAllBooks.length > 0) {
        setGetBooksInformationText(
          `Found ${newAllBooks.length} book${newAllBooks.length > 1 ? "s" : ""}...`
        )

        setAllBooks(newAllBooks)
      }
    },
    [formatAuthorName]
  )

  const getDailyReflection = async () => {
    setLoadingDailyReflectionVisible(true)

    let data = {}

    try {
      let newSecret = ""

      // first see if they're logged in in the browser

      if (!secret) {
        const connectResults = await fetch(`${domain}/api/public/connect`, {
          headers: {
            "Content-Type": "application/json; charset=utf-8",
            Authorization: `Bearer ${API_KEY}`,
            Accept: "application/json"
          }
        })

        const connectData = await connectResults.json()

        newSecret = connectData.data.secret
        setSecret(connectData.data.secret)
        storage.set("secret", connectData.data.secret)
      }

      const response = await fetch(`${domain}/api/public/daily-reflection`, {
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          Authorization: `Bearer ${API_KEY}~~~${secret ? secret : newSecret}`,
          Accept: "application/json"
        }
      })

      if (response.ok) {
        const responseData = await response.json()

        if (responseData.success) {
          setDailyReflection(responseData.data.dailyReflection)
          setCanConnect(true)
        } else {
          setDailyReflection({})
          setCanConnect(false)
        }
      } else {
        data = {}
      }
    } catch (error) {
      console.error("error", error)
      data = {}
    }

    setLoadingDailyReflectionVisible(false)
  }

  const getColorKey = useCallback((color) => {
    if (!color) return "grey"
    for (const key in colorLookup) {
      if (color.toLowerCase().includes(key.toLowerCase())) {
        return key
      }
    }
    return "grey"
  }, [])

  const convertBooksToCSV = useCallback((books) => {
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
        "location"
      ]
    ]

    books.forEach((book) => {
      if (Array.isArray(book.annotations) && book.annotations.length > 0) {
        book.annotations.forEach((annotation) => {
          csv.push([
            book.title || "",
            book.subtitle || "",
            book.author || "",
            book.imageUrl || "",
            book.asin || "",
            annotation.quote || "",
            annotation.note || "",
            annotation.color || "",
            annotation.location || ""
          ])
        })
      } else {
        csv.push([
          book.title || "",
          book.subtitle || "",
          book.author || "",
          book.imageUrl || "",
          book.asin || "",
          "", // quote
          "", // note
          "", // color
          "" // location
        ])
      }
    })

    return csv
      .map((row) =>
        row
          .map((cell) => {
            const sanitizedCell = sanitizeText(String(cell || ""))
            // Escape double quotes and wrap in quotes for CSV
            return `"${sanitizedCell.replace(/"/g, '""')}"`
          })
          .join(",")
      )
      .join("\n")
  }, [])

  const fetchData = useCallback(
    async (
      retries = 0,
      maxRetries = 3,
      paginationToken = null,
      accumulatedItems = []
    ) => {
      let urlToFetch = `https://${kindleURL}/kindle-library/search?libraryType=BOOKS&sortType=recency&querySize=50`
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
          referrer: `https://${kindleURL}/kindle-library`,
          method: "GET",
          mode: "cors"
        })

        if (response.ok) {
          const res = await response.json()
          const itemsList = res.itemsList || []
          accumulatedItems.push(...itemsList)
          console.log("response", response)

          if (res.paginationToken) {
            return await fetchData(
              0,
              maxRetries,
              res.paginationToken,
              accumulatedItems
            )
          }

          console.log("accumulatedItems", accumulatedItems)

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
            setLoginToKindleDivVisible(true)
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
          setLoginToKindleDivVisible(true)
        }
      }
    },
    [kindleURL, parseBooks]
  )

  const bookUploadProcess = useCallback(
    async (booksPassedIn) => {
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
            "Content-Type": "application/json; charset=utf-8",
            Authorization: `Bearer ${API_KEY}~~~${secret}`,
            Accept: "application/json"
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
            content: sanitizeText(annotation.quote),
            note: sanitizeText(annotation.note),
            color: sanitizeText(annotation.color),
            location: sanitizeText(annotation.location)
          }))
        )
        .filter((x) => x !== undefined)

      const failedIndexes = []

      for (let i = 0; i < quotesToInsertArray.length; i++) {
        try {
          const response = await fetch(`${domain}/api/public/quotes-insert`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json; charset=utf-8",
              Authorization: `Bearer ${API_KEY}~~~${secret}`,
              Accept: "application/json"
            },
            body: JSON.stringify(quotesToInsertArray[i])
          })

          if (!response.ok) {
            throw new Error(`Error inserting quote at index ${i}`)
          }

          try {
            await response.json()
          } catch (jsonError) {
            console.error(
              `JSON parsing error for quote at index ${i}:`,
              jsonError
            )
            throw new Error(`JSON parsing error for quote at index ${i}`)
          }
        } catch (error) {
          errorOccured = true
          console.error(`Failed to insert quote at index ${i}:`, error)
          failedIndexes.push(i)
        }
      }
      return !errorOccured
    },
    [API_KEY]
  )

  const parseSingleBook = useCallback(
    async (htmlContent: string): Promise<ParseSingleBookResult> => {
      return await new Promise((resolve) => {
        const parser = new DOMParser()
        const doc = parser.parseFromString(htmlContent, "text/html")

        const continuationTokenInput = doc.querySelector(
          ".kp-notebook-annotations-next-page-start" // this is an input
        )
        const continuationToken = continuationTokenInput
          ? (continuationTokenInput as HTMLInputElement).value
          : null

        const contentLimitStateInput = doc.querySelector(
          ".kp-notebook-content-limit-state"
        )
        const contentLimitState = contentLimitStateInput
          ? (contentLimitStateInput as HTMLInputElement).value
          : null

        const annotations = []

        const quotes = doc.querySelectorAll("#highlight")
        const note = doc.querySelectorAll("#note")
        const colorsAndLocations = doc.querySelectorAll(
          "#annotationHighlightHeader"
        )

        const length = Math.min(
          quotes.length,
          note.length,
          colorsAndLocations.length
        )

        for (let i = 0; i < length; i++) {
          const rawQuote = quotes[i].textContent?.trim() || ""
          const rawNote = note[i].textContent?.trim() || ""
          const rawColorAndLocation =
            colorsAndLocations[i].textContent?.trim() || ""
          const [rawColor = "", rawLocation = ""] =
            rawColorAndLocation.split(" | ")

          annotations.push({
            quote: sanitizeText(rawQuote),
            note: sanitizeText(rawNote),
            color: sanitizeText(rawColor),
            location: sanitizeText(rawLocation)
          })
        }

        resolve({
          annotations: annotations,
          continuationToken: continuationToken,
          contentLimitState: contentLimitState
        })
      })
    },
    []
  )

  interface ParseSingleBookResult {
    annotations: {
      quote: string
      note: string
      color: string
      location: string
    }[]
    continuationToken: string | null
    contentLimitState: string | null
  }

  const getEachBook = useCallback(
    async (booksToProcess, maxRetries = 5) => {
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
              urlToFetch = `https://${kindleURL}/notebook?asin=${book.htmlId}&contentLimitState=&`
            } else {
              urlToFetch = `https://${kindleURL}/notebook?asin=${
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
              console.log(`Rate limited. Waiting ${Number(retryAfter)}ms`)
              await new Promise((resolve) =>
                setTimeout(resolve, Number(retryAfter))
              )
              continue
            }

            if (!response.ok) throw new Error(`HTTP ${response.status}`)

            const html = await response.text()

            const result: ParseSingleBookResult = await parseSingleBook(html)

            if (result) {
              continuationToken = result.continuationToken
              contentLimitState = result.contentLimitState
              if (book.annotations && Array.isArray(book.annotations)) {
                book.annotations = [...book.annotations, ...result.annotations]
              } else {
                book.annotations = result.annotations
              }

              if (!continuationToken) {
                const uploadSuccess = await uploadSingleBook(book)
                book.uploaded = uploadSuccess
                if (uploadSuccess) {
                  const booksUploaded = [book]

                  let currentText = ""
                  booksUploaded.forEach((book) => {
                    currentText += `Uploaded "${book.title}"`
                  })
                  setGetBooksInformationText(currentText)

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
              await new Promise((resolve) => setTimeout(resolve, Number(delay)))
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
        const quoteCount = book.annotations?.length || 0
        finishedHtml += `\n${book.title} (${quoteCount} quote${quoteCount !== 1 ? "s" : ""})`
      })

      setSyncing(false)
      setFinishedSyncing(true)
      setGetBooksInformationText(finishedHtml)
    },
    [
      allBooks,
      bookUploadProcess,
      getBooksInformationText,
      setGetBooksInformationText
    ]
  )

  const uploadSingleBook = async (bookPassedIn) => {
    return await bookUploadProcess([bookPassedIn])
  }

  const handleDeselectAllClick = () => {
    setCheckedBookTitles([])
  }

  const handleSelectAllClick = () => {
    const allTitles = allBooks.map((book) => book.title)
    setCheckedBookTitles(allTitles)
  }

  const handleBookCheckboxChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const bookTitle = event.target.name
    const isChecked = event.target.checked

    if (isChecked) {
      setCheckedBookTitles([...checkedBookTitles, bookTitle])
    } else {
      setCheckedBookTitles(
        checkedBookTitles.filter((title) => title !== bookTitle)
      )
    }
  }

  const handleContinueGetBooksClick = () => {
    const filteredBooks = allBooks.filter((book) => {
      return checkedBookTitles.includes(book.title)
    })

    if (filteredBooks.length > 0) {
      setSyncing(true)
      setGetBooksInformationText(
        `Uploading ${filteredBooks.length} book${filteredBooks.length > 1 ? "s" : ""}...`
      )
      getEachBook(filteredBooks)
    }
  }

  const handleDownloadCsvClick = () => {
    const booksForCsv = allBooks.filter((book) => {
      return checkedBookTitles.includes(book.title)
    })
    const csv = convertBooksToCSV(booksForCsv)
    // Add BOM for proper UTF-8 encoding in Excel and other applications
    const BOM = "\uFEFF"
    const blob = new Blob([BOM + csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = "books.csv"
    link.click()
  }

  const handleGetNewReflectionClick = () => {
    window.open(`${domain}`, "_blank")
  }

  const handleLoginToKindleClick = () => {
    window.open(`https://${kindleURL}/notebook`, "_blank")
  }

  const handleSettingsButtonClick = () => {
    setSettingsScreenVisible(!settingsScreenVisible)
  }

  const handleApiKeyInputChange = (e) => {
    const newApiKey = e.target.value
    setAPI_KEY(newApiKey)
    storage.set("API_KEY", newApiKey)

    setSecret("")
    storage.set("secret", "")
  }

  const handleAutoSyncChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAutoSync((e.target as HTMLInputElement).checked)
    storage.set("autoSync", (e.target as HTMLInputElement).checked)
  }

  const handleKindleURLInputChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const newKindleURL = (e.target as HTMLInputElement).value
    setKindleURL(newKindleURL)
    storage.set("kindleURL", newKindleURL)
  }

  return (
    <div className="p-2 bg-[hsl(10,100%,93%)] w-[450px]">
      <link
        href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600&family=Crimson+Pro:wght@400;600;800&display=swap"
        rel="stylesheet"
      />
      <style>
        {`
          body {
              font-family: 'Poppins', sans-serif;
          }
          h2 {
              font-family: 'Crimson Pro', serif;
          }
        `}
      </style>
      <div className="container bg-[hsl(10,100%,93%)]">
        {loadingDailyReflectionVisible && (
          <h3 className="text-center">Loading...</h3>
        )}
        {!API_KEY && (
          <h3 className="text-center">
            Please put in your Unearthed API Key under Settings.
          </h3>
        )}
        {!dailyReflection?.source &&
          !loadingDailyReflectionVisible &&
          !canConnect &&
          API_KEY && (
            <h3 className="text-center">
              Check that your Unearthed API key is correct under Settings
            </h3>
          )}
        {!dailyReflection?.source &&
          !loadingDailyReflectionVisible &&
          canConnect &&
          API_KEY && (
            <h3 className="text-center">
              No Daily Reflection found, you may need to sync some books first.
            </h3>
          )}
        {dailyReflection?.source && (
          <div className="border-2 border-black rounded-lg bg-black">
            <div className="">
              <div className="rounded-t-lg bg-black text-white p-4 text-center">
                <h2 className="font-extrabold text-4xl text-center">
                  {dailyReflection.source?.title}
                </h2>
                <span className="text-xs text-center">
                  by: {dailyReflection.source?.author}
                </span>
              </div>
            </div>
            <div className="bg-[hsl(337,68%,97%)] p-4 rounded-lg">
              <div className="flex flex-col justify-between">
                <div>
                  <div
                    className="shadow-xl border-2 h-full p-4 flex bg-opacity-10 rounded-lg"
                    style={{
                      borderColor: dailyReflection.quote?.color
                        ? colorLookup[getColorKey(dailyReflection.quote?.color)]
                            .borderColor
                        : colorLookup["grey"].borderColor,
                      backgroundColor: dailyReflection.quote?.color
                        ? colorLookup[getColorKey(dailyReflection.quote?.color)]
                            .backgroundColor
                        : colorLookup["grey"].backgroundColor
                    }}>
                    <div
                      className="border-l-4 pl-4 h-full"
                      style={{
                        borderColor: dailyReflection.quote?.color
                          ? colorLookup[
                              getColorKey(dailyReflection.quote?.color)
                            ].borderColor
                          : colorLookup["grey"].borderColor,
                        color: dailyReflection.quote?.color
                          ? colorLookup[
                              getColorKey(dailyReflection.quote?.color)
                            ].color
                          : colorLookup["grey"].color
                      }}>
                      <p className="text-sm md:text-base">
                        {dailyReflection.quote?.content}
                      </p>
                    </div>
                  </div>
                  <div className="relative -top-6 right-4 flex justify-end py-2">
                    <div className="inline-flex items-center text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 h-8 border-2 p-2.5 rounded-md transition-shadow duration-200 bg-black border-white text-white z-0">
                      {dailyReflection.quote?.location}
                    </div>
                  </div>
                  <div
                    className="-mt-10 my-2 px-8"
                    style={{
                      display:
                        dailyReflection.quote?.note != "" ? "block" : "none"
                    }}>
                    <p className="ml-2 text-sm text-muted-foreground pt-2">
                      <span className="text-base font-bold text-[hsl(175,60%,20%)]">
                        Notes:
                      </span>
                      <span>{dailyReflection.quote?.note}</span>
                    </p>
                  </div>
                </div>
                <div
                  className="flex md:hidden w-full justify-center mt-2"
                  style={{
                    display: dailyReflection.source?.imageUrl ? "flex" : "none"
                  }}>
                  <img
                    alt="Picture of the book"
                    loading="lazy"
                    width="100"
                    height="100"
                    className="rounded-lg border-2 border-black shadow"
                    src={dailyReflection.source?.imageUrl}
                  />
                </div>
                <div className="flex md:hidden justify-center mt-2"></div>
                <button
                  className="bg-white inline-flex items-center justify-center whitespace-nowrap text-sm font-medium ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:bg-accent border-2 p-2.5 rounded-md transition-shadow duration-200 bg-card border-black shadow-[4px_4px_0px_rgba(0,0,0,1)] hover:shadow-[2px_2px_0px_rgba(0,0,0,1)] active:shadow-[1px_1px_0px_rgba(0,0,0,1)]  h-10 px-4 py-2 mt-4 w-full"
                  type="button"
                  onClick={handleGetNewReflectionClick}>
                  Get a new Daily Reflection
                </button>
              </div>
            </div>
          </div>
        )}
        {canConnect && allBooks.length == 0 && (
          <div className="mt-2 text-center">
            <div className="p-4 border-2 border-black rounded-lg bg-[hsl(337,68%,97%)]">
              <p className="text-xs text-neutral-600 mb-2">
                Press the button below to grab the latest data from your Kindle
                account.
              </p>
              <button
                className="bg-white inline-flex items-center justify-center whitespace-nowrap text-sm font-medium ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:bg-accent border-2 p-2.5 rounded-md transition-shadow duration-200 bg-card border-black shadow-[4px_4px_0px_rgba(0,0,0,1)] hover:shadow-[2px_2px_0px_rgba(0,0,0,1)] active:shadow-[1px_1px_0px_rgba(0,0,0,1)]  h-10 px-4 py-2 w-full"
                type="button"
                onClick={() => fetchData()}>
                Get Kindle Books
              </button>
            </div>
          </div>
        )}
        {allBooks.length > 0 && (
          <div className="mt-2 text-center">
            <div className="p-4 border-2 border-black rounded-lg bg-[hsl(337,68%,97%)]">
              {!syncing && !finishedSyncing && (
                <div className="flex justify-between mb-2">
                  <div className="w-full">
                    <button
                      className="bg-white inline-flex items-center justify-center whitespace-nowrap text-sm font-medium ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:bg-accent border-2 p-2.5 rounded-md transition-shadow duration-200 bg-card border-black shadow-[4px_4px_0px_rgba(0,0,0,1)] hover:shadow-[2px_2px_0px_rgba(0,0,0,1)] active:shadow-[1px_1px_0px_rgba(0,0,0,1)]  h-10 px-4 py-2 w-full"
                      type="button"
                      onClick={handleDeselectAllClick}>
                      Deselect All
                    </button>
                  </div>
                  <div className="w-full ml-2">
                    <button
                      className="bg-white inline-flex items-center justify-center whitespace-nowrap text-sm font-medium ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:bg-accent border-2 p-2.5 rounded-md transition-shadow duration-200 bg-card border-black shadow-[4px_4px_0px_rgba(0,0,0,1)] hover:shadow-[2px_2px_0px_rgba(0,0,0,1)] active:shadow-[1px_1px_0px_rgba(0,0,0,1)]  h-10 px-4 py-2 w-full"
                      type="button"
                      onClick={handleSelectAllClick}>
                      Select All
                    </button>
                  </div>
                </div>
              )}

              <p className="text-xs text-neutral-600 mb-2">
                {getBooksInformationText.split("\n").map((line, index) => (
                  <span key={index}>
                    {line}
                    {index < getBooksInformationText.length - 1 && <br />}
                  </span>
                ))}
              </p>
              {!syncing && !finishedSyncing && (
                <>
                  <div>
                    <ul className="list-none">
                      {allBooks.map((book) => (
                        <li key={book.htmlId}>
                          <label>
                            <input
                              type="checkbox"
                              checked={checkedBookTitles.includes(book.title)}
                              name={book.title}
                              onChange={handleBookCheckboxChange}
                            />
                            <span className="ml-2">{book.title}</span>
                          </label>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <button
                    className="bg-white inline-flex items-center justify-center whitespace-nowrap text-sm font-medium ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:bg-accent border-2 p-2.5 rounded-md transition-shadow duration-200 bg-card border-black shadow-[4px_4px_0px_rgba(0,0,0,1)] hover:shadow-[2px_2px_0px_rgba(0,0,0,1)] active:shadow-[1px_1px_0px_rgba(0,0,0,1)]  h-10 px-4 py-2 w-full"
                    type="button"
                    onClick={handleContinueGetBooksClick}>
                    Continue
                  </button>
                </>
              )}

              {finishedSyncing && (
                <>
                  <a
                    className="bg-white inline-flex items-center justify-center whitespace-nowrap text-sm font-medium ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:bg-accent border-2 p-2.5 rounded-md transition-shadow duration-200 bg-card border-black shadow-[4px_4px_0px_rgba(0,0,0,1)] hover:shadow-[2px_2px_0px_rgba(0,0,0,1)] active:shadow-[1px_1px_0px_rgba(0,0,0,1)]  h-10 px-4 py-2 w-full"
                    href="https://unearthed.app"
                    target="_blank"
                    rel="noopener noreferrer">
                    View on Unearthed
                  </a>
                  <button
                    className="mt-2 bg-white inline-flex items-center justify-center whitespace-nowrap text-sm font-medium ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:bg-accent border-2 p-2.5 rounded-md transition-shadow duration-200 bg-card border-black shadow-[4px_4px_0px_rgba(0,0,0,1)] hover:shadow-[2px_2px_0px_rgba(0,0,0,1)] active:shadow-[1px_1px_0px_rgba(0,0,0,1)]  h-10 px-4 py-2 w-full"
                    type="button"
                    onClick={handleDownloadCsvClick}>
                    Download CSV
                  </button>
                </>
              )}
            </div>
          </div>
        )}
        {loginToKindleDivVisible && (
          <div className="mt-2 text-center">
            <div className="p-4 border-2 border-black rounded-lg bg-[hsl(337,68%,97%)]">
              <p className="text-xs text-red-600 mb-2 font-bold">
                Please login in to https://{kindleURL}/notebook by clicking the
                button below.
                <br />
                After you login, open the extension and try the 'Get Kindle
                Books' button again.
              </p>
              <button
                className="bg-red-400 inline-flex items-center justify-center whitespace-nowrap text-sm font-medium ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:bg-accent border-2 p-2.5 rounded-md transition-shadow duration-200 bg-card border-black shadow-[4px_4px_0px_rgba(0,0,0,1)] hover:shadow-[2px_2px_0px_rgba(0,0,0,1)] active:shadow-[1px_1px_0px_rgba(0,0,0,1)]  h-10 px-4 py-2 w-full"
                type="button"
                onClick={handleLoginToKindleClick}>
                Login to https://{kindleURL}
              </button>
            </div>
          </div>
        )}
        {settingsScreenVisible && (
          <div>
            <div className="p-4 border-2 border-black rounded-lg bg-[hsl(337,68%,97%)] mt-4">
              <div className="mb-2">
                <label
                  htmlFor="apiKey"
                  className="block text-sm font-medium text-gray-700">
                  API Key
                </label>
                <label
                  htmlFor="apiKey"
                  className="block text-xs font-light text-gray-700">
                  Create one in the settings on unearthed.app
                </label>
                <input
                  type="text"
                  id="apiKey" // Added id to match htmlFor for accessibility
                  className="mt-1 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md p-2"
                  placeholder="Enter your API Key"
                  value={API_KEY}
                  onChange={handleApiKeyInputChange}
                />
              </div>
              <div className="mb-2">
                <label
                  htmlFor="kindleURL"
                  className="block text-sm font-medium text-gray-700">
                  Kindle URL
                </label>
                <label
                  htmlFor="kindleURL"
                  className="block text-xs font-light text-gray-700">
                  Change this if you are in a different country
                  <br />
                  Default is (read.amazon.com)
                </label>
                <input
                  type="text"
                  id="kindleURL"
                  className="mt-1 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md p-2"
                  placeholder="Enter your Kindle URL"
                  value={kindleURL}
                  onChange={handleKindleURLInputChange}
                />
              </div>

              <div className="mt-4">
                <label
                  htmlFor="autoSync"
                  className="block text-sm font-medium text-gray-700"></label>
                <label
                  htmlFor="autoSync"
                  className="block text-xs font-light text-gray-700">
                  Sync books automatically in the background. This will happen
                  once per day (even if you do not open the extension)
                </label>
                <input
                  type="checkbox"
                  id="autoSync"
                  className="mt-1 block shadow-sm sm:text-sm border-gray-300 rounded-md"
                  checked={autoSync}
                  onChange={handleAutoSyncChange}
                />
              </div>
            </div>
          </div>
        )}
        <div className="settings-button-container text-center mt-2">
          <button
            className="bg-white inline-flex items-center justify-center whitespace-nowrap text-sm font-medium ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:bg-accent border-2 p-2.5 rounded-md transition-shadow duration-200 bg-card border-black shadow-[4px_4px_0px_rgba(0,0,0,1)] hover:shadow-[2px_2px_0px_rgba(0,0,0,1)] active:shadow-[1px_1px_0px_rgba(0,0,0,1)] h-10 px-4 py-2 w-full"
            type="button"
            onClick={handleSettingsButtonClick}>
            Settings
          </button>
        </div>
      </div>
    </div>
  )
}

export default IndexPopup