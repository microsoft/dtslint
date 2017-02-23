"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_promise_1 = require("fs-promise");
const stripJsonComments = require("strip-json-comments");
function readJson(path) {
    return __awaiter(this, void 0, void 0, function* () {
        const text = yield fs_promise_1.readFile(path, "utf-8");
        return JSON.parse(stripJsonComments(text));
    });
}
exports.readJson = readJson;
//# sourceMappingURL=util.js.map