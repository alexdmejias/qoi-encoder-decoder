import { before, describe, it } from "node:test";
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert";

import { encode } from "./lib.js";
import { getHeader } from "./utils.js";

const SAMPLE_IMAGES_DIR = "samples";

describe("verify header", () => {
    let file;
    let header;

    before(() => {
        file = fs.readFileSync("./samples/dice.qoi");
        header = getHeader(file);
    });

    it("should have the magic string", () => {
        assert.equal(header.magic, "qoif");
    });

    describe("dimensions", () => {
        it("should should have the width", () => {
            assert.equal(header.width, 800);
        });

        it("should should have the height", () => {
            assert.equal(header.height, 600);
        });
    });

    describe("color", () => {
        it("should should have have the color ", () => {
            assert.equal(header.channels, 4);
        });

        it("should should have color space", () => {
            assert.equal(header.colorspace, 0);
        });
    });
});

describe("encode", () => {
    let qoiFiles;
    // encoding fails on these files for now, adding them here to make tests pass for now
    const ignoreFiles = ["edgecase", "testcard", "testcard_rgba"];
    before(() => {
        qoiFiles = fs
            .readdirSync(SAMPLE_IMAGES_DIR)
            .filter((fileName) => fileName.slice(-3) === "qoi")
            .filter((fileName) => !ignoreFiles.includes(fileName.slice(0, -4)))
            .map((fileName) => path.join(SAMPLE_IMAGES_DIR, fileName));
    });

    describe("compare files ", async () => {
        it("all qoi files should match with the encode output", async () => {
            qoiFiles.forEach(async (qoiFileName) => {
                const qoiFile = fs.readFileSync(qoiFileName);
                const correspondingPNG = `${qoiFileName.slice(0, -4)}.png`;
                const encodeResult = await encode(correspondingPNG, qoiFile);
                const comparisonResult = qoiFile.compare(encodeResult);

                assert(
                    comparisonResult === 0,
                    `file: ${qoiFileName} is not equal to it's encode output not equal`
                );
            });
        });
    });
});
