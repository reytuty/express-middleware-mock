"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var express = require("express");
var index_1 = require("../lib/index");
var app = express();
app.use("/", function (req, res, next) {
    next();
});
app.use(express.json());
app.use((0, index_1.default)("./example/mock/"));
app.listen(3000, function () {
    console.log("Server running on port 3000");
});
