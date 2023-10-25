import { NextFunction, Request, Response } from "express";
import * as path from "path";
import * as fs from "node:fs";
import { fakeResultCreator } from "./fakeResultCreator";
export default function mockJson(folder: string, customHandler: any = {}) {
  const mock = (req: Request, res: Response, next: NextFunction) => {
    const basePath = folder + req.originalUrl.split("?")[0];
    const unixPathRequest = basePath + "/request.json";
    const unixPathResponse = basePath + "/response.json";
    checkRedirect(req, res, basePath);
    let pathString = path.join(...unixPathRequest.split("/"));
    if (fs.existsSync(pathString)) {
      const validateRequestResult = validateRequest(
        req,
        JSON.parse(fs.readFileSync(pathString) + "")
      );
      if (!validateRequestResult.success) {
        return res.status(400).send(validateRequestResult);
      }
    }
    fakeResultCreator(req, res, unixPathResponse, customHandler);
  };
  return mock;
}

const specialValidators: { [key: string]: Function } = {
  headers: (data: any, propName: string) => {
    if (propName == "file" || propName == "files") {
      const hasFile = data["content-type"]?.startsWith("multipart/form-data");
      return hasFile == true;
    }
    if (propName == "token") {
      const hasToken = data["authorization"]?.startsWith("Bearer");
      return hasToken == true;
    }
    return true;
  },
};
function validateRequest(
  req: any,
  content: any
): {
  success: boolean;
  result: { [key: string]: { [key: string]: string } };
  messages: string[];
} {
  let result: {
    success: boolean;
    result: { [key: string]: { [key: string]: string } };
    messages: string[];
  } = { success: true, result: {}, messages: [] };
  for (let propName in content) {
    if (!req[propName]) {
      continue;
    }
    result.result[propName] = {};
    let requestProp: any = req[propName];
    for (let varName in content[propName]) {
      try {
        if (content[propName][varName]) {
          //se é necessário, valida
          if (!specialValidators[propName](requestProp, varName)) {
            result.success = false;
            result.result[propName][
              varName
            ] = `expected ${propName}.${varName}`;
            result.messages.push(`expected ${propName}.${varName}`);
          }
        }
      } catch (e: any) {
        if (content[propName][varName] && !requestProp[varName]) {
          result.success = false;
          result.result[propName][varName] = `expected ${propName}.${varName}`;
          result.messages.push(`expected ${propName}.${varName}`);
        }
      }
    }
  }
  return result;
}
//pega os jsons fake para resultado mock de redirect
function checkRedirect(req: Request, res: Response, basePath: string) {
  //redirect json
  const unixPath = basePath + "/redirect.json";
  let pathString = path.join(...unixPath.split("/"));
  if (fs.existsSync(pathString)) {
    let { to } = JSON.parse(fs.readFileSync(pathString) + "");
    if (to) {
      let params = req.originalUrl.split("?")[1];
      req.originalUrl =
        to +
        (params
          ? "?" + params + "&_is_redirected=true"
          : "?_is_redirected=true");
      console.log(to);
    }
  }
}
