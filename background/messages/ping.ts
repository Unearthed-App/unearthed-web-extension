import type { PlasmoMessaging } from "@plasmohq/messaging"

const parse5 = require("parse5")

const handler: PlasmoMessaging.MessageHandler = async (req, res) => {
  console.log("IN PING recieved", req)
  const val = await parseBook()
  const yeah = {
    sdfsdf: val
  }

  const hey = await parseBook()

  res.send({
    message: yeah,
    hey
  })
}

async function parseBook() {
  console.log(`Parssssssssssssssssing Book`)

  const document = parse5.parse(
    "<!DOCTYPE html><html><head></head><body>Hello there!</body></html>"
  )

  console.log(document.childNodes[1].tagName) //=> 'html'

  return "heey there butd..." + document.childNodes[1].tagName
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

// async function parseBook(htmlId, htmlContent) {
//   return await new Promise((resolve) => {
//     const parser = new DOMParser()
//     const doc = parser.parseFromString(htmlContent, "text/html")

//     const continuationTokenInput = doc.querySelector(
//       ".kp-notebook-annotations-next-page-start"
//     )
//     const continuationToken = continuationTokenInput
//       ? continuationTokenInput.value
//       : null

//     const contentLimitStateInput = doc.querySelector(
//       ".kp-notebook-content-limit-state"
//     )
//     const contentLimitState = contentLimitStateInput
//       ? contentLimitStateInput.value
//       : null

//     const annotations = []

//     const quotes = doc.querySelectorAll("#highlight")
//     const note = doc.querySelectorAll("#note")
//     const colorsAndLocations = doc.querySelectorAll(
//       "#annotationHighlightHeader"
//     )

//     const length = Math.min(
//       quotes.length,
//       note.length,
//       colorsAndLocations.length
//     )

//     for (let i = 0; i < length; i++) {
//       annotations.push({
//         quote: quotes[i].textContent?.trim() || "",
//         note: note[i].textContent?.trim() || "",
//         color: colorsAndLocations[i].textContent?.trim().split(" | ")[0] || "",
//         location:
//           colorsAndLocations[i].textContent?.trim().split(" | ")[1] || ""
//       })
//     }

//     resolve({
//       annotations: annotations,
//       continuationToken: continuationToken,
//       contentLimitState: contentLimitState
//     })
//   })
// }

export default handler
