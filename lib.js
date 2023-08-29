import fs from "node:fs";
import Jimp from "jimp";

const QOI_OP_RGB = "QOI_OP_RGB";
const QOI_OP_RGBA = "QOI_OP_RGBA";
const QOI_OP_INDEX = "QOI_OP_INDEX";
const QOI_OP_DIFF = "QOI_OP_DIFF";
const QOI_OP_LUMA = "QOI_OP_LUMA";
const QOI_OP_RUN = "QOI_OP_RUN";

const LABEL_QOI_OP_RGB = 0b11111110;
const LABEL_QOI_OP_RGBA = 0b11111111;
const LABEL_QOI_OP_INDEX = 0b00000000;
const LABEL_QOI_OP_DIFF = 0b01000000;
const LABEL_QOI_OP_LUMA = 0b10000000;
const LABEL_QOI_OP_RUN = 0b11000000;

function getHash(r, g, b, a = 255) {
    // console.log('@@@@@@@@', {r, g, b, a});
    return (r * 3 + g * 5 + b * 7 + a * 11) % 64;
}

function h2d(hex) {
    return parseInt(hex, 16);
}

export function logNum(num = 0) {
    return {
        hex: num.toString(2).padStart(8, "0"),
        binary: num.toString(16).padStart(2, "0").toUpperCase(),
        dec: num.toString(),
        lastSix: parseInt(num.toString(2).slice(2), 2),
    };
}

function getTagName(possibleTag) {
    possibleTag = possibleTag.padStart(8, "0");

    switch (possibleTag) {
        case "11111110":
            return QOI_OP_RGB;
        case "11111111":
            return QOI_OP_RGBA;
        default:
            let two = `${possibleTag[0]}${possibleTag[1]}`;
            switch (two) {
                case "00":
                    return QOI_OP_INDEX;
                case "01":
                    return QOI_OP_DIFF;
                case "10":
                    return QOI_OP_LUMA;
                case "11":
                    return QOI_OP_RUN;
                default:
                    return "UNKNOWN";
            }
    }
}

function advance({ run, imageBuff, state }) {
    const rawTagName = imageBuff.readUInt8(++state.runner).toString(2);
    const tagName = getTagName(rawTagName);

    console.log("@@@@@@@@ tag: ", tagName, "raw: ", rawTagName);

    if (tagName === QOI_OP_RGB || tagName === QOI_OP_RGBA) {
        state.r = imageBuff.readUInt8(++state.runner);
        state.g = imageBuff.readUInt8(++state.runner);
        state.b = imageBuff.readUInt8(++state.runner);

        if (tagName === QOI_OP_RGBA) {
            state.a = imageBuff.readUInt8(++state.runner);
        }

        const pos = getHash(state.r, state.g, state.b, state.a);

        run[pos] = { r: state.r, g: state.g, b: state.b, a: state.a };

        console.log("!!!!!!!!", "added item to postion:", pos);
    } else if (tagName === QOI_OP_INDEX) {
        const bits = parseInt(rawTagName, 2);
        console.log("!!!!!!!!", { bits }, " -> ", run[bits]);
    } else if (tagName === QOI_OP_DIFF) {
        throw new Error("TODO QOI_OP_DIFF");
    } else if (tagName === QOI_OP_LUMA) {
        throw new Error("TODO QOI_OP_LUMA");
    } else if (tagName === QOI_OP_RUN) {
        throw new Error("TODO QOI_OP_RUN");
    } else {
        throw new Error("TODO UNKNOWN");
    }
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

export async function main() {
    let runner = 4;
    const image = fs.readFileSync("./samples/qoi/baboon.qoi");
    console.log("$$$$$$$$", { image });

    console.log(
        "@@@@@@@@ magic string:",
        String.fromCharCode(...image.subarray(0, runner))
    );
    console.log("@@@@@@@@ width:", image.readUInt32BE(runner).toString());
    console.log("@@@@@@@@ height:", image.readUInt32BE(8).toString());
    runner = 12;
    console.log("@@@@@@@@ channels:", image.readUInt8(runner).toString());
    console.log("@@@@@@@@ colorspace:", image.readUInt8(++runner).toString());

    // let r = 0;
    // let g = 0;
    // let b = 0;
    // let a = 255;

    const state = {
        runner,
        r: 0,
        g: 0,
        b: 0,
        a: 255,
    };
    let run = new Array(64);

    for (let i = 0; i < 5; i++) {
        advance({
            run,
            state,
            imageBuff: image,
        });

        console.log("########", state);
    }
}

function compareColors(a, b) {
    return a.r === b.r && a.g === b.g && a.b === b.b && a.a === b.a;
}

function getColorDiff(a, b) {
    return {
        r: a.r - b.r,
        g: a.g - b.g,
        b: a.b - b.b,
        a: a.a - b.a,
    };
}

function isNumInRange(num, floor, ceiling) {
    return num >= floor && num <= ceiling;
}

function write(state, compareBuffer, ...items) {
    items.forEach((item) => {
        if (item !== compareBuffer[state.offset]) {
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
            // fs.writeFileSync("./output-incomplete.qoi", buffer);
            throw new Error(`${item} !== ${compareBuffer[state.offset]}`);
        }

        state.offset = state.buffer.writeUInt8(item, state.offset);
    });

    return state.offset;
}

function createQOIHeader({ width, height, channels, colorspace }) {
    const buffer = Buffer.alloc(14);

    let offset = buffer.write("qoif");
    offset = buffer.writeInt32BE(width, offset);
    offset = buffer.writeInt32BE(height, offset);
    offset = buffer.writeInt8(channels, offset);

    buffer.writeUInt8(colorspace, offset);

    return buffer;
}

export async function encode(filePath, correspondingQoiBuffer) {
    const jimp = await Jimp.read(filePath);
    const { width, height } = jimp.bitmap;
    const channels = jimp.hasAlpha() ? 4 : 3;
    // TODO
    const colorspace = 0;

    const headerBuffer = createQOIHeader({
        width,
        height,
        channels,
        colorspace,
    });

    const footerSeq = [0, 0, 0, 0, 0, 0, 0, 1];

    // represents the max possible size of the buffer based on the worst case scenario, the returned buffer will be smaller
    const bufferSize =
        width * height * channels +
        headerBuffer.length +
        colorspace +
        footerSeq.length;

    const state = {
        offset: headerBuffer.length,
        buffer: Buffer.concat([headerBuffer], bufferSize),
    };
    const pixels = Array.from({ length: 64 }).fill({ r: 0, g: 0, b: 0, a: 0 });

    const write8 = (...items) => {
        return write(state, correspondingQoiBuffer, ...items);
    };

    const finalizeRun = () => {
        const result = LABEL_QOI_OP_RUN | (run - 1);

        write8(result);
        run = 0;
    };

    let prevPixel = {
        r: 0,
        g: 0,
        b: 0,
        a: 255,
    };
    let run = 0;

    for (const { idx } of jimp.scanIterator(
        0,
        0,
        jimp.bitmap.width,
        jimp.bitmap.height
    )) {
        const [r, g, b, a = 0] = jimp.bitmap.data.slice(idx, idx + 4);
        const currPixel = { r, g, b, a };
        const prevIsCurr = compareColors(currPixel, prevPixel);

        if (prevIsCurr) {
            run++;
            if (run === 62) {
                finalizeRun();
            }
        } else {
            if (run > 0) {
                finalizeRun();
            }

            const hash = getHash(r, g, b, a);

            if (compareColors(currPixel, pixels[hash])) {
                write8(LABEL_QOI_OP_INDEX | hash);
            } else {
                pixels[hash] = currPixel;

                const diff = getColorDiff(currPixel, prevPixel);
                const drDg = diff.r - diff.g;
                const dbDg = diff.b - diff.g;

                if (diff.a === 0) {
                    if (
                        isNumInRange(diff.r, -2, 1) &&
                        isNumInRange(diff.g, -2, 1) &&
                        isNumInRange(diff.b, -2, 1)
                    ) {
                        const result =
                            LABEL_QOI_OP_DIFF |
                            ((diff.r + 2) << 4) |
                            ((diff.g + 2) << 2) |
                            ((diff.b + 2) << 0);
                        write8(result);
                    } else if (
                        isNumInRange(diff.g, -32, 31) &&
                        isNumInRange(drDg, -8, 7) &&
                        isNumInRange(dbDg, -8, 7)
                    ) {
                        write8(
                            LABEL_QOI_OP_LUMA | (diff.g + 32),
                            ((drDg + 8) << 4) | (dbDg + 8)
                        );
                    } else {
                        write8(LABEL_QOI_OP_RGB, r, g, b);
                    }
                } else {
                    write8(LABEL_QOI_OP_RGBA, r, g, b, a);
                }
            }
        }

        prevPixel = currPixel;
    }

    // finalize the last potential run
    if (run !== 0) {
        finalizeRun();
    }

    write8(...footerSeq);

    // only return the buffer that is occupied
    return state.buffer.slice(0, state.offset);
}
