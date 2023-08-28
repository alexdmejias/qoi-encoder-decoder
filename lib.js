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

function write(buffer, offset, compareBuffer, ...items) {
    items.forEach((item) => {
        if (item !== compareBuffer[offset]) {
            console.log("\n\nerror in write function\n\n#:", offset);
            console.table([
                {
                    name: "old",
                    ...logNum(compareBuffer[offset]),
                },
                {
                    name: "new",
                    ...logNum(item),
                },
            ]);
            console.log("\n\n");
            // offset = buffer.writeUInt8(item, offset);
            // fs.writeFileSync("./output-incomplete.qoi", buffer);
            throw new Error(`${item} !== ${compareBuffer[offset]}`);
        }

        offset = buffer.writeUInt8(item, offset);
    });

    return offset;
}

export async function encode(filePath, correspondingQoiBuffer) {
    const jimp = await Jimp.read(filePath);
    const { width, height } = jimp.bitmap;
    const isRGBA = jimp.hasAlpha();

    const channels = isRGBA ? 4 : 3;
    const bufferSize = width * height * (channels + 1) + 14 + 8;

    const buf = Buffer.alloc(bufferSize);

    let offset = buf.write("qoif");
    offset = buf.writeInt32BE(width, offset);
    offset = buf.writeInt32BE(height, offset);

    offset = write(buf, offset, correspondingQoiBuffer, channels, 0);

    const pixels = Array.from({ length: 64 }).fill({ r: 0, g: 0, b: 0, a: 0 });
    let prevPixel = {
        r: 0,
        g: 0,
        b: 0,
        a: 255,
    };

    let run = 0;

    for (const { x, y, idx } of jimp.scanIterator(
        0,
        0,
        jimp.bitmap.width,
        jimp.bitmap.height
    )) {
        const r = jimp.bitmap.data[idx + 0];
        const g = jimp.bitmap.data[idx + 1];
        const b = jimp.bitmap.data[idx + 2];
        const a = jimp.bitmap.data[idx + 3];

        const currPixel = { r, g, b, a };
        const prevIsCurr = compareColors(currPixel, prevPixel);

        if (prevIsCurr) {
            run++;
            if (run === 62) {
                const result = LABEL_QOI_OP_RUN | (run - 1);

                offset = write(buf, offset, correspondingQoiBuffer, result);
                run = 0;
            }
        } else {
            if (run > 0) {
                const result = LABEL_QOI_OP_RUN | (run - 1);

                offset = write(buf, offset, correspondingQoiBuffer, result);
                run = 0;
            }

            const hash = getHash(r, g, b, a);

            if (compareColors(currPixel, pixels[hash])) {
                offset = write(
                    buf,
                    offset,
                    correspondingQoiBuffer,
                    LABEL_QOI_OP_INDEX | hash
                );
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
                        offset = write(
                            buf,
                            offset,
                            correspondingQoiBuffer,
                            result
                        );
                    } else if (
                        isNumInRange(diff.g, -32, 31) &&
                        isNumInRange(drDg, -8, 7) &&
                        isNumInRange(dbDg, -8, 7)
                    ) {
                        offset = write(
                            buf,
                            offset,
                            correspondingQoiBuffer,
                            LABEL_QOI_OP_LUMA | (diff.g + 32),
                            ((drDg + 8) << 4) | (dbDg + 8)
                        );
                    } else {
                        offset = write(
                            buf,
                            offset,
                            correspondingQoiBuffer,
                            LABEL_QOI_OP_RGB,
                            r,
                            g,
                            b
                        );
                    }
                } else {
                    offset = write(
                        buf,
                        offset,
                        correspondingQoiBuffer,
                        LABEL_QOI_OP_RGBA,
                        r,
                        g,
                        b,
                        a
                    );
                }
            }
        }

        prevPixel = currPixel;
    }

    // finalize the last potential run
    if (run !== 0) {
        const result = LABEL_QOI_OP_RUN | (run - 1);

        offset = write(buf, offset, correspondingQoiBuffer, result);
        run = 0;
    }

    offset = write(buf, offset, correspondingQoiBuffer, 0, 0, 0, 0, 0, 0, 0, 1);

    return buf.slice(0, offset);
}
