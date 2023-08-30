import Jimp from "jimp";

import {
    getHash,
    compareColors,
    getColorDiff,
    isNumInRange,
    write,
    createQOIHeader,
} from "./utils.js";

import {
    LABEL_QOI_OP_RGB,
    LABEL_QOI_OP_RGBA,
    LABEL_QOI_OP_INDEX,
    LABEL_QOI_OP_DIFF,
    LABEL_QOI_OP_LUMA,
    LABEL_QOI_OP_RUN,
} from "./constants.js";

export async function encode({
    filePath,
    earlyExit = false,
    logDiff = false,
    correspondingQoiBuffer,
}) {
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
        return write(
            {
                state,
                compareBuffer: correspondingQoiBuffer,
                earlyExit,
                logDiff,
            },
            ...items
        );
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

                if (currPixel.a === prevPixel.a) {
                    const diff = getColorDiff(currPixel, prevPixel);
                    const vgr = diff.r - diff.g;
                    const vgb = diff.b - diff.g;
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
                        isNumInRange(vgr, -8, 7) &&
                        isNumInRange(vgb, -8, 7)
                    ) {
                        write8(
                            LABEL_QOI_OP_LUMA | (diff.g + 32),
                            ((vgr + 8) << 4) | (vgb + 8)
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
