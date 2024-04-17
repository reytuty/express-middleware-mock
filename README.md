# express-middleware-mock

Middleware to mock requests using jsons and semantic folders on express

## Installation

```
npm i express-middleware-mock
```

## Usage

```
import express, { Request, Response, NextFunction } from "express";
import cors from "cors"; //optional
import mockJson from "express-middleware-mock";

const USE_MOCK = process.env.USE_MOCK || false;
const MOCK_FOLDER = process.env.MOCK_FOLDER || './jsons';

const app = express();
app.use(cors());
app.use(express.json());

//here your router
const router = express.Router();
router.get(
  "/my/router/example",
  async (req: Request, res: Response) => {
    res.status(200).send({
      success: true,
      messages: ["ok"]
    })
  }
);

if (USE_MOCK) {
  //if enter here
  app.use(mockJson(MOCK_FOLDER));
}

```

## Creating Requests and Responses

To create requests and responses you need to create a folder with semantic name as a request path, and put two files `request.json` and `response.json` inside OR you can create just a single file named `redirect.json`

### request.json file

Request file simbolise what do you need to receive as query params, body or parameter, and the syntax need to be:

```
{
  "params": {
    "someValueFromQueryParams": true
  },
  "header":{
    "someHeadersParamsHere": true
  },
  "body":{
    "myPostParamHere": true
  },
  "query":{
    "myQueryParamHere": true
  }
}
```

- body: for params inside a body request (not work for GET methods)
- query: for params on url, after ? simble, like `?skip=0`
- params: it is not possible to check url params yet

Examples:

To recieve userId and userEmail on post method

```
{
    "body": {
        "userId": true,
        "userEmail": true
    }
}
```

To recieve skip and limit on get method as url params, but not optionaly, and category need to be setted

```
{
    "query": {
        "skip": false,
        "limit": false,
        "category": true
    }
}
```

### response.json file

Just need to be a valid json file and they will be used in body result.

The middleware will be put automatic properties to indentify this result as a fake result

```
{
  isRedirected: true,
  fakeResult: true
}
```

And if you put some values that exists on faker as a method or inside a objectHandler as a methodName, the value will be put with a method result.

You also can create a response using a list response pattern like this:

| tip: If you use this struture to result list, the fake result layer will simulate a list of result

```
{
  "total": 405,
  "skiped": 0,
  "limited": 10,
  "list": [
    {
      "id": "uuid",
      "name": "name.fullName",
      "description": "lorem",
      "otherThing": "{query.skip}"
    }
  ]
}
```

And they will be simulate 405 results on database to create a pagination system. Notice that you just need to put 1 object inside an array and they will use this as a pattern to create others.

You can response asingle result:

```
{
  "id": "uuid",
  "category": "that|this|other"
}
```

| tips: if you put pipe `|` to split string, they will random someone to result

### Create your own fake result

You can create your own result handler

```
const myHandler = {
  mySecret:()=>{
    return "my secret word here"
  }
}

if (USE_MOCK) {
  //using your own handler
  app.use(mockJson(MOCK_FOLDER, myHandler));
}
```

| tip: Use relative path with `./` or absolute path

And now you can use:

```
{
  "category": "that|this|other",
  "test" : "mySecret"
}
```

The result will be:

```
{
  "category": "other",
  "test" : "my secret word here"
}
```

### Folder Exemple

```
.
 /mock
    /test
      /a
        request.json
        response.json
    /my
      /router
        /example
          request.json
          response.json
        /example-2
          request.json
          response.json
          errors.json
    /other
      /[paramName] <- this variable goes to params variable as paramName
        /test
    /api
      /users
        /list
          redirect.json
```

We have 3 examples here and all of them inside a 'jsons' folder.

- `test/a` using request/response files
- `my/router/example` using request/response files BUT using a existed router path
- `my/router/example-2` using request/response and chance to result error
- `api/users/list` using redirect.json file
