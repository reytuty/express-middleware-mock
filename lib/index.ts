import { NextFunction, Request, Response } from "express";
import * as path from "path";
import * as fs from "node:fs";
import { fakeResultCreator } from "./fakeResultCreator";
import { error } from "console";
export interface ErrorChanceInterface {
  percentChance: number;
  status: number;
  body?: string;
}
export default function mockJson(folder: string, customHandler: any = {}) {
  const mock = (req: Request, res: Response, next: NextFunction) => {
    const basePath = folder + req.originalUrl.split("?")[0];
    const unixPathRequest = basePath + "/request.json";
    const unixPathResponse = basePath + "/response.json";
    const unixPathErrors = basePath + "/errors.json";
    checkRedirect(req, res, basePath);
    let pathString = path.join(...unixPathRequest.split("/"));
    let pathStringErrors = path.join(...unixPathErrors.split("/"));
    if (fs.existsSync(pathStringErrors)) {
      const simulatedError = checkSimulatedErrors(
        JSON.parse(fs.readFileSync(pathStringErrors) + "") as
          | ErrorChanceInterface
          | ErrorChanceInterface[]
      ) as ErrorChanceInterface;
      if (simulatedError) {
        return res
          .status(simulatedError?.status || 500)
          .send(simulatedError?.body ?? "Simulated error");
      }
    }
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
function checkSimulatedErrors(
  errorsChances: undefined | ErrorChanceInterface | ErrorChanceInterface[]
): ErrorChanceInterface | null {
  if (!errorsChances) {
    return null;
  }
  if (Array.isArray(errorsChances)) {
    for (const errorChance of errorsChances) {
      const error = checkSimulatedErrors(errorChance);
      if (error) {
        return error as ErrorChanceInterface;
      }
    }
    return null;
  }
  if (errorsChances?.percentChance > 0) {
    const happends: boolean = Math.random() * 100 < errorsChances.percentChance;
    if (happends) {
      return errorsChances;
    }
  }
  return null;
}
function validateRequest(
  req: Request,
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
  const methods: string[] | undefined = content?.headers.methods;
  if (
    methods &&
    Array.isArray(methods) &&
    methods.indexOf(`${req.method}`.toUpperCase()) < 0
  ) {
    //was defined method but the request is different that
    result.success = false;
    result.messages.push(
      `The method ${req.method} is not listed on ${methods.join(",")}`
    );
  }
  for (let propName in content) {
    if (!(req as any)[propName]) {
      continue;
    }
    result.result[propName] = {};
    let requestProp: any = (req as any)[propName];
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
