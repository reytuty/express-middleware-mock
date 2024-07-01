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
const cacheFolders = new Map<
  string,
  {
    regex: RegExp;
    variables: string[];
  }
>();
export default function mockJson(folder: string, customHandler: any = {}) {
  createCacheFolder(folder);
  const mock = (req: Request, res: Response, next: NextFunction) => {
    if (req.originalUrl === "/sw.js") {
      // Ignore Service Worker requests
      return next();
    }
    const basePath = folder + req.originalUrl.split("?")[0];
    //check if the basePath is a folder
    let pathStringFolder = path.join(...basePath.split("/"));
    if (!fs.existsSync(pathStringFolder)) {
      //check using regex
      let hasFolder = false;
      cacheFolders.forEach((value, key) => {
        if (hasFolder) {
          return;
        }
        let resultTest = value.regex.test(pathStringFolder);
        if (resultTest) {
          const variables = pathStringFolder.match(value.regex)?.slice(1);
          let params = {};
          if (variables) {
            params = variables.reduce((acc, variable, index) => {
              (acc as any)[value.variables[index]] = variable;
              return acc;
            }, {});
          }
          req.params = params;
          pathStringFolder = key;
          hasFolder = true;
        }
      });
      if (!hasFolder) {
        console.log("Folder not found", pathStringFolder);
        return res.status(404).send("Not found");
      }
    }
    const unixPathRequest = pathStringFolder + "/request.json";
    const unixPathResponse = pathStringFolder + "/response.json";
    const unixPathErrors = pathStringFolder + "/errors.json";
    checkRedirect(req, res, pathStringFolder);
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
  const methods: string[] | undefined = content?.headers?.methods;
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
function createCacheFolder(folder: string) {
  //list each subfolder of folder to array string list
  let folders = getLinearFolders(folder);
  //filter folders without response.json
  folders = folders.filter((folder) => {
    return fs.existsSync(path.join(folder, "response.json"));
  });
  //transform each folder to regex replacing [varName] to accept every string that is not [ or ]
  folders.map((folder) => {
    //find all variables likes [varName] inside a folderName and save it in array string without [] simble
    const variables = folder.match(/\[.+\]/g);
    //remove [] simble from variables
    const variablesWithoutSimble = variables?.map((variable) => {
      return variable.replace(/[\[\]]/g, "");
    });
    if (variablesWithoutSimble) {
      //cross plataform replace for directories windows , linux and mac
      const regexPath = folder.replace(/[\[\]]/g, "").split(path.sep).join("\\\\");
      cacheFolders.set(folder, {
        regex: new RegExp(regexPath.replace(/\[.+\]/g, "([^/]+)")),
        variables: variablesWithoutSimble || [],
      });
    }
  });
}

function getLinearFolders(basePath: string): string[] {
  const subFolders: string[] = [];

  function traverse(directory: string) {
    const items = fs.readdirSync(directory, { withFileTypes: true });
    items.forEach((item) => {
      const fullPath = path.join(directory, item.name);
      if (item.isDirectory()) {
        subFolders.push(fullPath);
        traverse(fullPath);
      }
    });
  }

  traverse(basePath);
  return subFolders;
}
