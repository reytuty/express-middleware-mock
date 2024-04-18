import express = require("express");
import mockJson from "../index";

const app = express();

app.use("/", (req, res, next) => {
  next();
});
app.use(express.json());
app.use(mockJson("./example/mock/"));

app.listen(3000, () => {
  console.log("Server running on port 3000");
});
