#!/usr/bin/env node

'use strict';

const localBat_sample = require('commander');
const chalk = require('chalk');

const BatNode = require('../batnode').BatNode;
const PERSONAL_DIR = require('../utils/file').PERSONAL_DIR;
const HOSTED_DIR = require('../utils/file').HOSTED_DIR;
const fileSystem = require('../utils/file').fileSystem;
const fs = require('fs');

localBat_sample
  .description("Demo connection for local Bat nodes")
  .option('-u, --upload <filePath>', 'upload files from specified file path')
  .option('-d, --download <manifestPath>', 'retrieve files from manifest file path')
  .parse(process.argv);

console.log(chalk.bold.magenta("Hello, welcome to batchain!"));

const node1 = new BatNode();
node1.port = 1237;
node1.host = '127.0.0.1';

const node3 = new BatNode();
node3.port = 1238;
node3.host = '127.0.0.1';

if (localBat_sample.upload) {
  console.log(chalk.yellow('sample node2 uploads files to sample node1/node3'));

  // process file upload in the specified path('../encrypt/orgexp.txt');
  const node2 = new BatNode();
  
  // send to only one node
  // node2.uploadFile(node1.port, node1.host, bat_sample.upload);
  
  // send to multiple nodes
  node2.uploadFile(localBat_sample.upload);

} else if (localBat_sample.download) {
  console.log(chalk.yellow('sample node2 downloads files from sample node1/node3'));
  const node2 = new BatNode();
  
  // retrieve file from one node: node2.retrieveFile('example.txt.crypt', 1237, '127.0.0.1')
  // node2.retrieveFileFromOneNode(bat_sample.download, node1.port, node1.host, function() {
  //   console.log("File download and decrypt complete");
  // });
  
  // retrieve file from nodes
  node2.retrieveFile(localBat_sample.download);

} else {
  runSampleNode();
}


// Define callback for server to execute when a new connection has been made.
// The connection object can have callbacks defined on it
// Below is a node server that can respond to file retrieval requests or file storage requests

// When sending image data as part of JSON object, two JSON objects are sent, each sending an incomplete JSON object
// with only part of the image data
function runSampleNode() {
  const node1ConnectionCallback = (serverConnection) => {
    serverConnection.on('data', (receivedData, error) => {
    // console.log("received data: ", receivedData)
      receivedData = JSON.parse(receivedData);
      //console.log(receivedData, "FROM SERVER")

      if (receivedData.messageType === "RETRIEVE_FILE") {
        node1.readFile(`./hosted/${receivedData.fileName}`, (error, data) => {
        serverConnection.write(data)
        })
      } else if (receivedData.messageType === "STORE_FILE"){
        node1.receiveFile(receivedData)
        serverConnection.write(JSON.stringify({messageType: "SUCCESS"}))
      }
    })
  }

  console.log("Start sample node1/node3 server");
  node1.createServer(1237,'127.0.0.1', node1ConnectionCallback, null)

  node3.createServer(1238,'127.0.0.1', node1ConnectionCallback, null)

  //fileSystem.processUpload('../personal/example.txt')
  //fileSystem.composeShards('../manifest/4f112a6ec12a710bc3cc4fba8d334ab09f87e2c4.batchain') //results in a decrypted-example.txt saved to personal dir

}
