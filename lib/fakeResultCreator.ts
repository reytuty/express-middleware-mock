import { Request, Response } from "express";
import * as path from "path";
import * as fs from "node:fs";
import { Faker, faker } from "@faker-js/faker";
import { v4 as uuid } from "uuid";

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
  cpf: () => {
    const mod = (dividendo: number, divisor: number) =>
      Math.round(dividendo - Math.floor(dividendo / divisor) * divisor);
    const randNums = String(Math.random()).slice(2, 11);
    let d1 =
      11 -
      mod(
        randNums
          .split("")
          .reverse()
          .reduce((acc, cur, idx) => acc + parseInt(cur) * (idx + 2), 0),
        11
      );
    if (d1 >= 10) d1 = 0;

    let d2 =
      11 -
      mod(
        d1 * 2 +
          randNums
            .split("")
            .reverse()
            .reduce((acc, cur, idx) => acc + parseInt(cur) * (idx + 3), 0),
        11
      );
    if (d2 >= 10) d2 = 0;

    const cpfGenerated = `${randNums}${d1}${d2}`;

    return cpfGenerated;
  },
};
export function fakeResultCreator(
  req: Request,
  res: Response,
  unixPath: string,
  customHandler: { [name: string]: Function } = {}
) {
  const searchObjectList: any = {
    params: req.params,
    query: req.query,
    body: req.body,
    headers: req.headers,
    env: process.env,
  };
  creators = { ...creators, ...customHandler };
  let pathString = path.join(...unixPath.split("/"));
  if (fs.existsSync(pathString)) {
    //checking for fake result
    try {
      let data = JSON.parse(fs.readFileSync(pathString) + "");

      if (typeof data == "object") {
        data = duplicateRandomItem(data, searchObjectList);
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
function duplicateRandomItem(item: any, searchObjectList: any): any {
  if (Array.isArray(item)) {
    return item;
  }
  let clone = { ...item };
  if (clone?.list && Array.isArray(clone.list) && clone.list.length == 1) {
    // if (clone?.list && Array.isArray(clone.list) && clone.list.length == 1) {
    //tem apenas 1 item no array, verificar a construção de conteúdo fake baseado nesse primeiro objeto como template
    //verificando quantidade de itens
    let skipped = parseInt(
      searchObjectList?.query?.skip || clone?.skipped || 0
    );
    let limited = parseInt(
      searchObjectList?.query?.limit || clone?.limited || 30
    );
    let total = parseInt(clone?.total || 40);
    if (total > 0 && limited > 0 && total > skipped) {
      //end size
      let sizeOut = Math.min(total - skipped, limited);
      let arrResult = [];
      while (sizeOut-- > 0) {
        arrResult.push(duplicateRandomItem(clone.list[0], searchObjectList));
      }
      clone = {
        skipped,
        limited,
        total,
        list: arrResult,
      };
      return clone;
    }
  }
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
        } else {
          //check if fName has a {name} to be replaced
          let regex = /\{([\.a-zA-Z0-9_-]+)\}/g;
          const resultRegex = regex.exec(fName);
          if (resultRegex) {
            const [contextName, varName] = resultRegex[1].split(".");
            if (searchObjectList[contextName][varName]) {
              clone[i] = searchObjectList[contextName][varName];
            }
          }
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
        clone[i][0] = duplicateRandomItem(clone[i][0], searchObjectList);
        continue;
      }
      let choices = fName.split("|");
      if (choices.length > 1) {
        let total = Math.round(Math.random() * choices.length - 1);
        clone[i] = uniqueSubset(choices, total);
        continue;
      }
      clone[i] = duplicateRandomItem(clone[i], searchObjectList);
      continue;
    }
    if (typeof clone[i] == "object" && Object.keys(clone[i]).length > 0) {
      clone[i] = duplicateRandomItem(clone[i], searchObjectList);
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
