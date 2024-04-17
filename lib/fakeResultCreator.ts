import { Request, Response } from "express";
import * as path from "path";
import * as fs from "node:fs";
import { Faker, faker } from "@faker-js/faker";
import { v4 as uuid } from "uuid";
faker.name.fullName;
let creators = {
  ...faker,
  hour: () => {
    return (
      Math.round(Math.random() * 9 + 9) +
      ":" +
      Math.round(Math.random() * 9) +
      "" +
      Math.round(Math.random() * 9)
    );
  },
  uuid,
  rand_int: () => {
    return Math.round(Math.random() * 59) + 1;
  },
  boolean: () => {
    return Math.round(Math.random() * 1000) % 2 == 0;
  },
};
export function fakeResultCreator(
  req: Request,
  res: Response,
  unixPath: string,
  customHandler: { [name: string]: Function } = {}
) {
  creators = { ...creators, ...customHandler };
  let pathString = path.join(...unixPath.split("/"));
  if (fs.existsSync(pathString)) {
    //checking for fake result
    try {
      let data = JSON.parse(fs.readFileSync(pathString) + "");
      if (data?.list && Array.isArray(data.list) && data.list.length == 1) {
        //tem apenas 1 item no array, verificar a construção de conteúdo fake baseado nesse primeiro objeto como template
        //verificando quantidade de itens
        let skipped = parseInt(req?.query?.skip || data?.skipped || 0);
        let limited = parseInt(req?.query?.limit || data?.limited || 30);
        let total = parseInt(data?.total || 40);
        if (total > 0 && limited > 0 && total > skipped) {
          //end size
          let sizeOut = Math.min(total - skipped, limited);
          let arrResult = [];
          while (sizeOut-- > 0) {
            arrResult.push(duplicateRandomItem(data.list[0]));
          }
          return res.send({
            success: true,
            result: {
              skipped,
              limited,
              total,
              list: arrResult,
            },
            fakeResult: true,
            messages: ["fake result"],
          });
        }
      }
      if (typeof data == "object") {
        data = duplicateRandomItem(data);
      }
      if (data?.file) {
        //o resultado é um arquivo
        return resolveFile(data.file, res);
      }
      data.isRedirected = req.query._is_redirected || false;
      data.fakeResult = true;
      return res.send(data);
    } catch (e) {
      res.status(500).send({
        success: false,
        result: e,
        messages: ["Erro ao parsear o json em response"],
      });
    }
  }
  res
    .status(404)
    .send({ success: false, isRedirected: req.query._is_redirected || false });
  //next();
}
//faker.name.fullName()
function duplicateRandomItem(item: any): any {
  let clone = { ...item };
  //switch values
  for (let i in clone) {
    if (clone[i] === null) {
      continue;
    }
    if (typeof clone[i] == "string") {
      let fName: string = clone[i] as string;
      //find a pipe
      let choices = fName.split("|");
      if (Array.isArray(choices) && choices.length > 1) {
        const totalChoices = choices.length;
        let index = Math.max(0, Math.floor(Math.random() * totalChoices - 0.5));
        clone[i] = choices[index];
        fName = clone[i];
      }
      if (fName) {
        const method: Function | null = findMethod(creators, fName);
        if (method) {
          clone[i] = method();
        }
      }
      continue;
    }
    if (Array.isArray(clone[i])) {
      let arr = clone[i];
      if (arr.length != 1) {
        continue;
      }
      let fName = clone[i][0];
      if (typeof fName == "object" && Object.keys(fName).length > 0) {
        clone[i][0] = duplicateRandomItem(clone[i][0]);
        continue;
      }
      let choices = fName.split("|");
      if (choices.length > 1) {
        let total = Math.round(Math.random() * choices.length - 1);
        clone[i] = uniqueSubset(choices, total);
        continue;
      }
      clone[i] = duplicateRandomItem(clone[i]);
      continue;
    }
    if (typeof clone[i] == "object" && Object.keys(clone[i]).length > 0) {
      clone[i] = duplicateRandomItem(clone[i]);
      continue;
    }
  }
  return clone;
}

function findMethod(ob: any, fName: string): Function | null {
  if (!ob) {
    return null;
  }
  let props: string[] = fName.split(".");
  let propValue: any = ob[props[0]];
  if (!propValue) {
    return null;
  }
  if (props.length > 1) {
    props.shift();
    return findMethod(propValue, props.join("."));
  }
  if (typeof propValue == "function") {
    return propValue as Function;
  }
  return null;
}
function uniqueSubset(choices: any[], total: number): any[] {
  // Verifica se o número de escolhas é menor ou igual ao valor total
  if (choices.length <= total) {
    // Retorna todas as opções
    return choices;
  }
  // Verifica se o número de opções únicas é menor ou igual ao valor total
  if (choices.length <= total) {
    // Retorna todas as opções únicas
    return choices;
  }
  // Retorna um subconjunto aleatório das opções únicas com tamanho igual ao valor total
  const shuffled = choices.sort(() => 0.5 - Math.random());
  return shuffled.slice(0, total);
}
function resolveFile(file: string, res: Response) {
  const fileName = path.basename(file);
  res.download(file, fileName, (error) => {
    if (error) {
      console.error("Erro ao enviar o arquivo:", error);
      res.status(500).json({ message: "Erro ao fazer o download do arquivo." });
    }
  });
}
