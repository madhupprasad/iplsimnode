import fs from "fs";
import request from "request";
import lodash from "lodash";

var download = function (uri, filename, callback) {
    request.head(uri, function (err, res) {
        console.log("content-type:", res.headers["content-type"]);
        console.log("content-length:", res.headers["content-length"]);

        request(uri).pipe(fs.createWriteStream(filename)).on("close", callback);
    });
};

let cricketersRawData = JSON.parse(fs.readFileSync("cricketers.json"));

for (let item of cricketersRawData) {
    let url = item["imgsrc"];
    let name = lodash.snakeCase(item["player"]);
    download(url, `images/${name}.jpg`, function () {
        console.log("done");
    });
}
