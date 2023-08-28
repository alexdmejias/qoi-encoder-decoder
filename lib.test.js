import { before, describe, it } from "node:test";
import fs from "node:fs";
import assert from "node:assert";

import { getHeader } from "./lib.js";

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
