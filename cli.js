import fs from "node:fs";
import { encode, logNum } from "./lib.js";

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
        const result = await encode(args[3], correspondingQoi);

        fs.writeFileSync(args[4], result);

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
    } else if (func === "decode") {
        throw new Error("TODO");
    } else {
        throw new Error(`unknown command: "${func}"`);
    }
}

main();
