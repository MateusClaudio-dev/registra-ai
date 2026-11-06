# Quiz Calculator Prototype

This is a code bundle for Quiz Calculator Prototype. The original project is available at [https://www.figma.com/design/1tenfAa97QNdzafDeckhHK/Quiz-Calculator-Prototype.](https://registraai2026.web.app)

## Running the code

Run `npm i` to install the dependencies.

Run `npm run dev` to start the development server.

## Publicar no Firebase Hosting

Instale a CLI do Firebase uma vez: `npm install -g firebase-tools`.

Depois, na pasta do projeto, entre na sua conta e vincule um projeto Firebase:

```sh
firebase login
firebase use --add
```

Selecione o projeto desejado. Para publicar ou atualizar o site, execute:

```sh
npm run deploy:firebase
```

O comando gera a pasta `dist` e a publica no Firebase Hosting. A primeira configuracao requer acesso a uma conta Google com um projeto Firebase.
