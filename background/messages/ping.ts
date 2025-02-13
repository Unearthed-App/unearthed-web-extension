import type { PlasmoMessaging } from "@plasmohq/messaging";

const handler: PlasmoMessaging.MessageHandler = async (req, res) => {

  if (req.body.command == "parseSingleBook") {
    // const parsedBook = await parseSingleBook(
    //   req.body.html,
    //   req.body.htmlContent
    // )

    // res.send({
    //   parsedBook
    // })
  }
}

export default handler