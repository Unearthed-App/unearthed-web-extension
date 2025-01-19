const fs = require("fs");
const path = require("path");
const archiver = require("archiver");

const output = fs.createWriteStream(
  path.join(__dirname, "unearthed-extension.zip")
);
const archive = archiver("zip", { zlib: { level: 9 } });

output.on("close", function () {
  console.log("Archive has been finalized and the file has been written.");
});

archive.pipe(output);

archive.directory("popup/", false);
archive.directory("src/", false);

archive.finalize();
