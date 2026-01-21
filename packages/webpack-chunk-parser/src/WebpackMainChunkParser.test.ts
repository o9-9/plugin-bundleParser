import { assert, describe, expect, it } from "vitest";

import { getFile } from "./__test__/testingUtil";
import { WebpackMainChunkParser } from "./WebpackMainChunkParser";

describe(
    "MainChunkParser",
    function () {
        function commonTests(parser: WebpackMainChunkParser, delay?: number) {
            it("locates __webpack_require__", function () {
                const n = parser.__webpack_require__;

                expect(n
                    ?.declarations
                    .map(parser.makeRangeFromAstNode.bind(parser)))
                    .toMatchSnapshot();
            }, delay);
            it("locates __webpack_modules__", function () {
                const n = parser.__webpack_modules__;

                expect(n
                    ?.declarations
                    .map(parser.makeRangeFromAstNode.bind(parser)))
                    .toMatchSnapshot();
            }, delay);
            it("gets js chunk hashes", function () {
                const hashes = parser.getJsChunkHashes();

                expect(hashes.toSorted()).toMatchSnapshot();
            });
            it("gets all initial module text", function () {
                const moduleMap = parser.getDefinedModules();

                assert(moduleMap);

                const keys = Object.keys(moduleMap);
                const numEntries = parser.getModuleObject()?.properties.length;

                expect(keys.length, "An entry was missed").to.equal(numEntries);
                expect(keys).toMatchSnapshot();
            });
        }

        const fullParser = new WebpackMainChunkParser(getFile("fullWeb.js"));
        const partParser = new WebpackMainChunkParser(getFile("partWeb.js"));

        describe("with partial file", function () {
            const parser = partParser;

            commonTests(parser);
        });
        describe("with full file", function () {
            const parser = fullParser;

            commonTests(parser, 30_000);
        });
        describe("fullFile results are the same as partFile results", function () {
            it("js chunk hashes match", function () {
                const full = fullParser.getJsChunkHashes().toSorted();
                const part = partParser.getJsChunkHashes().toSorted();

                expect(full).to.deep.equal(part);
            });
        });
    },
);
