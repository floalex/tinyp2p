#!/usr/bin/env node

'use strict';

const bat_sample = require('commander');
const chalk = require('chalk');

const BatNode = require('../batnode').BatNode;
const PERSONAL_DIR = require('../utils/file').PERSONAL_DIR;
const HOSTED_DIR = require('../utils/file').HOSTED_DIR;
const fileSystem = require('../utils/file').fileSystem;
const fs = require('fs');
const path = require('path');

bat_sample
  .description("Demo connection for kad nodes and bat nodes")
  .option('-u, --upload <filePath>', 'upload files from specified file path')
  .option('-d, --download <manifestPath>', 'retrieve files from manifest file path')
  .option('-a, --audit <manifestPath>', 'audit files from manifest file path')
  .option('-p, --patch <manifestPath>', 'creates copies of vulnerable data shards to ensure data availability')
  .option('-s, --sha <filePath>', 'Returns the SHA1 of the files content. Useful for debugging purposes')
  .parse(process.argv);

const cliNode = new BatNode();
let client;

function sendUploadMessage() {
  
  const message = {
    messageType: "CLI_UPLOAD_FILE",
    filePath: bat_sample.upload,
  };
        
  client.write(JSON.stringify(message));
}

function sendDownloadMessage() {
  
  const message = {
    messageType: "CLI_DOWNLOAD_FILE",
    filePath: bat_sample.download,
  };
        
  client.write(JSON.stringify(message));
}

function sendAuditMessage(filePath, logOut=true) {
  return new Promise((resolve, reject) => {
    const message = {
      messageType: "CLI_AUDIT_FILE",
      filePath: filePath,
    };

    client.write(JSON.stringify(message));

    client.on('data', (data, error) => {
      if (error) { throw error; }
      const auditData = JSON.parse(data);
      const manifest = fileSystem.loadManifest(filePath);

      resolve(auditData);
      console.log(`File name: ${manifest.fileName} | Baseline data redundancy: ${auditData.passed}`);
    })

    client.on('error', (err) => {
      reject(err);
    })
  })
}

function findRedundantShard(auditData, failedSha) {
  const shardKeys = Object.keys(auditData[failedSha]);
  const isRetrievabalShard = (shardKey) => {
    return auditData[failedSha][shardKey] === true;
  }
  console.log('findRedundantShard - auditData[failedSha]', auditData[failedSha]);
  return shardKeys.find(isRetrievabalShard);
}

async function sendPatchMessage(manifestPath) {
  try {
    const audit = await sendAuditMessage(manifestPath);
    if (!audit.passed) {
      // patching goes here
      audit.failed.forEach((failedShaId) => {
        const siblingShardId = findRedundantShard(audit.data, failedShaId);
        if (siblingShardId) {
          const message = {
            messageType: "CLI_PATCH_FILE",
            manifestPath: manifestPath,
            failedShaId: failedShaId,
            siblingShardId: siblingShardId,
          };

          console.log('sendPatchMessage - message: ', message);
          client.write(JSON.stringify(message));

        } else {
          console.log(chalk.cyan(`No redundant shards for ${failedShaId}. You\'ll need to upload the source file to perform a patch`));
        }
      });
    } else {
      console.log(chalk.green('Your file has sufficient data redundancy across the network. No need to patch!'));
    }
  } catch(error) {
    console.log(error);
  }
}

function validManifestExt(filePath) {
  const validExtention = '.batchain';
  return validExtention === path.extname(filePath);
}

if (bat_sample.upload) {
  client = cliNode.connect(1800, 'localhost');

  console.log(chalk.yellow('You can only upload one file at a time'));
  
  if (!fs.existsSync(bat_sample.upload)) {
    console.log(chalk.red('You entered an invalid file path, please enter a valid file and try again'));   
  } else {
    console.log(chalk.yellow('sample node3 uploads files to sample node1/node2'));
    sendUploadMessage();
  }

} else if (bat_sample.download) {
  client = cliNode.connect(1800, 'localhost');
  
  console.log(chalk.yellow('You can only download one file at a time'));
  
  if (!fs.existsSync(bat_sample.download) || !validManifestExt(bat_sample.download)) {
    console.log(chalk.red('You entered an invalid manifest path, please enter a valid file and try again'));   
  } else {
    console.log(chalk.yellow('sample node3 downloads files from sample node1/node2'));
    sendDownloadMessage();
  }
  
} else if (bat_sample.audit) {
  client = cliNode.connect(1800, 'localhost');
  console.log(chalk.yellow('You can audit file to make sure file integrity'));
  
  if (!fs.existsSync(bat_sample.audit) || !validManifestExt(bat_sample.audit)) {
    console.log(chalk.red('You entered an invalid manifest path, please enter a valid file and try again'));   
  } else {
    console.log(chalk.yellow('sample node3 audits files from sample node1/node2'));
    sendAuditMessage(bat_sample.audit);
  }
  
} else if (bat_sample.patch) {
  client = cliNode.connect(1800, 'localhost');

  if (!fs.existsSync(bat_sample.patch)) {
   console.log(chalk.red('You entered an invalid manifest path, please enter a valid file and try again'));
  } else {
    console.log(chalk.yellow('Checking data redundancy levels for file'));
    sendPatchMessage(bat_sample.patch);
  }
} else if (bat_sample.sha) {
  console.log(chalk.yellow('Calculating SHA of file contents'));
  const fileSha = fileSystem.sha1Hash(bat_sample.sha);
  console.log(fileSha);
} else {
  console.log(chalk.bold.magenta("Welcome to Batchain demo"));
  console.log(chalk.bold.magenta("Please make sure you have started the server"));
}