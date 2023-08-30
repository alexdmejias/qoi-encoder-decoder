import fs from "node:fs";

export function getHash(r, g, b, a = 255) {
    return (r * 3 + g * 5 + b * 7 + a * 11) % 64;
}

export function h2d(hex) {
    return parseInt(hex, 16);
}

export function logNum(num = 0) {
    return {
        binary: num.toString(2).padStart(8, "0"),
        hex: num.toString(16).padStart(2, "0").toUpperCase(),
        dec: num.toString(),
        lastSix: parseInt(num.toString(2).slice(2), 2),
    };
}

// export function getTagName(possibleTag) {
//     possibleTag = possibleTag.padStart(8, "0");

//     switch (possibleTag) {
//         case "11111110":
//             return QOI_OP_RGB;
//         case "11111111":
//             return QOI_OP_RGBA;
//         default:
//             let two = `${possibleTag[0]}${possibleTag[1]}`;
//             switch (two) {
//                 case "00":
//                     return QOI_OP_INDEX;
//                 case "01":
//                     return QOI_OP_DIFF;
//                 case "10":
//                     return QOI_OP_LUMA;
//                 case "11":
//                     return QOI_OP_RUN;
//                 default:
//                     return "UNKNOWN";
//             }
//     }
// }

// export function advance({ run, imageBuff, state }) {
//     const rawTagName = imageBuff.readUInt8(++state.runner).toString(2);
//     const tagName = getTagName(rawTagName);

//     console.log("@@@@@@@@ tag: ", tagName, "raw: ", rawTagName);

//     if (tagName === QOI_OP_RGB || tagName === QOI_OP_RGBA) {
//         state.r = imageBuff.readUInt8(++state.runner);
//         state.g = imageBuff.readUInt8(++state.runner);
//         state.b = imageBuff.readUInt8(++state.runner);

//         if (tagName === QOI_OP_RGBA) {
//             state.a = imageBuff.readUInt8(++state.runner);
//         }

//         const pos = getHash(state.r, state.g, state.b, state.a);

//         run[pos] = { r: state.r, g: state.g, b: state.b, a: state.a };

//         console.log("!!!!!!!!", "added item to postion:", pos);
//     } else if (tagName === QOI_OP_INDEX) {
//         const bits = parseInt(rawTagName, 2);
//         console.log("!!!!!!!!", { bits }, " -> ", run[bits]);
//     } else if (tagName === QOI_OP_DIFF) {
//         throw new Error("TODO QOI_OP_DIFF");
//     } else if (tagName === QOI_OP_LUMA) {
//         throw new Error("TODO QOI_OP_LUMA");
//     } else if (tagName === QOI_OP_RUN) {
//         throw new Error("TODO QOI_OP_RUN");
//     } else {
//         throw new Error("TODO UNKNOWN");
//     }
// }

export function compareColors(a, b) {
    return a.r === b.r && a.g === b.g && a.b === b.b && a.a === b.a;
}

export function getColorDiff(a, b) {
    return {
        r: a.r - b.r,
        g: a.g - b.g,
        b: a.b - b.b,
        a: a.a - b.a,
    };
}

export function isNumInRange(num, floor, ceiling) {
    return num >= floor && num <= ceiling;
}

export function write({ state, compareBuffer, earlyExit, logDiff }, ...items) {
    items.forEach((item) => {
        if (item !== compareBuffer[state.offset]) {
            if (logDiff) {
                console.log("\n\nerror in write function\n\n#:", state.offset);
                console.table([
                    {
                        name: "old",
                        ...logNum(compareBuffer[state.offset]),
                    },
                    {
                        name: "new",
                        ...logNum(item),
                    },
                ]);
                console.log("\n\n");
                state.offset = state.buffer.writeUInt8(item, state.offset);
                fs.writeFileSync("./output-incomplete.qoi", state.buffer);
            }
            if (earlyExit) {
                throw new Error(`${item} !== ${compareBuffer[state.offset]}`);
            }
        }

        state.offset = state.buffer.writeUInt8(item, state.offset);
    });

    return state.offset;
}

export function createQOIHeader({ width, height, channels, colorspace }) {
    const buffer = Buffer.alloc(14);

    let offset = buffer.write("qoif");
    offset = buffer.writeInt32BE(width, offset);
    offset = buffer.writeInt32BE(height, offset);
    offset = buffer.writeInt8(channels, offset);

    buffer.writeUInt8(colorspace, offset);

    return buffer;
}

export function getHeader(buf) {
    return {
        magic: String.fromCharCode(...buf.subarray(0, 4)),
        width: buf.readUInt32BE(4).toString(),
        height: buf.readUInt32BE(8).toString(),
        channels: buf.readUInt8(12).toString(),
        colorspace: buf.readUInt8(13).toString(),
    };
}
