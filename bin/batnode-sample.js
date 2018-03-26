#!/usr/bin/env node

'use strict';

const bat_sample = require('commander');
const chalk = require('chalk');

const PERSONAL_DIR = require('../utils/file').PERSONAL_DIR;
const HOSTED_DIR = require('../utils/file').HOSTED_DIR;
const fileSystem = require('../utils/file').fileSystem;
const fs = require('fs');

const BatNode = require('../kad-bat-plugin/batnode.js').BatNode;
  
bat_sample
  .description("Demo connection for kad nodes and bat nodes")
  .option('-u, --upload <filePath>', 'upload files from specified file path')
  .option('-d, --download <manifestPath>', 'retrieve files from manifest file path')
  .parse(process.argv);

const cliNode = new BatNode();

if (bat_sample.upload) {
  console.log(chalk.yellow('sample node3 uploads files to sample node1/node2'));
  
  const client = cliNode.connect(1800, 'localhost');
  
  let message = {
    messageType: "CLI_UPLOAD_FILE",
    filePath: bat_sample.upload,
  };
        
  client.write(JSON.stringify(message));

} else if (bat_sample.download) {
  console.log(chalk.yellow('sample node3 downloads files from sample node1/node2'));

  // retrieve file from nodes
  // node3.retrieveFile(bat_sample.download);

} else {  
  console.log(chalk.bold.magenta("Hello, welcome to kad-bat demo!"));
  console.log("Please make sure you have started the server");
}

