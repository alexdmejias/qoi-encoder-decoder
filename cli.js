import fs from "node:fs";
import { encode } from "./lib.js";
import { logNum } from "./utils.js";

async function main() {
    const args = [...process.argv];

    if (args.length < 5) {
        // process.argv.forEach(function (val, index, array) {
        //     console.log(index + ": " + val);
        // });

        throw new Error("not enough args");
    }

    const func = args[2];
    if (func === "encode") {
        const correspondingQoi = fs.readFileSync(args[3].slice(0, -3) + "qoi");
        const result = await encode({
            filePath: args[3],
            correspondingQoiBuffer: correspondingQoi,
        });

        console.log("creating file...");
        fs.writeFileSync(args[4], result);

        console.log("file created");
        console.log("verifying file...");

        for (let i = 0; i < result.byteLength; i++) {
            const element = correspondingQoi[i];
            const newFileElement = result[i];

            if (element !== newFileElement) {
                console.log("\n\nerror in verification function\n\n#:", i);

                console.table([
                    {
                        name: "old",
                        ...logNum(element),
                    },
                    {
                        name: "new",
                        ...logNum(newFileElement),
                    },
                ]);
                break;
            }
        }
        console.log("file verified");
    } else if (func === "decode") {
        throw new Error("TODO");
    } else {
        throw new Error(`unknown command: "${func}"`);
    }
}

main();
