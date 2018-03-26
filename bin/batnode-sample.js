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
let client = cliNode.connect(1800, 'localhost');

function sendUploadMessage() {
  client = cliNode.connect(1800, 'localhost');
  
  let message = {
    messageType: "CLI_UPLOAD_FILE",
    filePath: bat_sample.upload,
  };
        
  client.write(JSON.stringify(message));
}

function sendDownloadMessage() {
  client = cliNode.connect(1800, 'localhost');
  
  let message = {
    messageType: "CLI_DOWNLOAD_FILE",
    filePath: bat_sample.download,
  };
        
  client.write(JSON.stringify(message));
}

if (bat_sample.upload) {
  console.log(chalk.yellow('You can only upload one file at a time'));
  
  if (!fs.existsSync(bat_sample.upload)) {
    console.log(chalk.red('You entered an invalid path, please press ^C and try again'));   
  } else {
    console.log(chalk.yellow('sample node3 uploads files to sample node1/node2'));
    sendUploadMessage();
  }

} else if (bat_sample.download) {
  console.log(chalk.yellow('sample node3 downloads files from sample node1/node2'));

  sendDownloadMessage();

} else {  
  console.log(chalk.bold.magenta("Hello, welcome to kad-bat demo!"));
  console.log(chalk.bold.magenta("Please make sure you have started the server"));
}





