const fs = require("fs");
const path = require("path");
const handlebars = require("handlebars");
const deployConfig = require("../config.json");

const subgraphTpl = fs.readFileSync(path.join(__dirname, "../templates/subgraph.yaml")).toString();
const template = handlebars.compile(subgraphTpl);

const configCtx = {
  ...deployConfig,
  dataSources: deployConfig
    .dataSources
    .map(({ address, startBlock, network }) => ({
      network: network || deployConfig.network,
      address,
      startBlock,
    })),
};

console.info(`Preparing ${configCtx.dataSources.length} sources on ${configCtx.network} network...`);

const res = template(configCtx);
const resFilePath = path.join(__dirname, "../subgraph.yaml");
fs.writeFileSync(resFilePath, res);

console.info(`Subgraph generated at ${resFilePath}`);
