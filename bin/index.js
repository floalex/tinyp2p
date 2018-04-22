#!/usr/bin/env node

'use strict';

const batchain = require('commander');
const chalk = require('chalk');

const BatNode = require('../kad-bat-plugin/batnode').BatNode;
const PERSONAL_DIR = require('../utils/file').PERSONAL_DIR;
const HOSTED_DIR = require('../utils/file').HOSTED_DIR;
const fileSystem = require('../utils/file').fileSystem;
const stellar = require('../utils/stellar').stellar;
const fs = require('fs');
const path = require('path');
const CLI_SERVER = require('../constants').CLI_SERVER;

batchain
  .command('sample', 'see the sample nodes running in LAN')
  .option('-l, --list', 'view your list of uploaded files in BatChain network')
  .option('-u, --upload <filePath>', 'upload files from specified file path')
  .option('-d, --download <manifestPath>', 'retrieve files from manifest file path')
  .option('-a, --audit <manifestPath>', 'audit files from manifest file path')
  .option('-p, --patch <manifestPath>', 'creates copies of vulnerable data shards to ensure data availability')
  .option('-s, --sha <filePath>', 'Returns the SHA1 of the files content. Useful for debugging purposes')
  .option('--stellar', 'Returns the balances of your stellar account as well as your public account ID')
  .parse(process.argv);

const cliNode = new BatNode();
let client;

function sendUploadMessage() {
  const message = {
    messageType: "CLI_UPLOAD_FILE",
    filePath: batchain.upload,
  };

  client.write(JSON.stringify(message));
  client.on('data', (data) => {
    console.log(data.toString())
    client.end()
  })
}

function sendDownloadMessage() {
  const message = {
    messageType: "CLI_DOWNLOAD_FILE",
    filePath: batchain.download,
  };

  client.write(JSON.stringify(message));
}

function getBaselineRedundancyFor(shardId, auditData){
 return Object.keys(auditData[shardId]).map((id) => {
    if (auditData[shardId][id] === true){
      return 1;
    } else {
      return 0
    }
  }).reduce((prev, curr) => {
    return prev += curr
  }, 0)
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
      Object.keys(auditData.data).forEach(distinctShard => {
        console.log('| ', distinctShard, ' | ', 'copies of this shard on the network that are retrievable: ', getBaselineRedundancyFor(distinctShard, auditData.data))
      })
    })

    client.on('error', (err) => {
      reject(err);
    })
  })
}

function getStallerAccountInformation() {
 const id = fileSystem.getStellarAccountId();
 stellar.getAccountInfo(id)
}

function findRedundantShard(auditData, failedSha) {
  const shardKeys = Object.keys(auditData[failedSha]);
  const isRetrievabalShard = (shardKey) => {
    return auditData[failedSha][shardKey] === true;
  }
  console.log('findRedundantShard - auditData[failedSha]', auditData[failedSha]);
  return shardKeys.find(isRetrievabalShard);
}

function findFailedShardCopies(auditData, failedSha){
  const shardCopiesOfFailedShard = Object.keys(auditData[failedSha]);
  return shardCopiesOfFailedShard.filter(key => {
    return auditData[failedSha][key] === false;
  })
}

async function sendPatchMessage(manifestPath) {
  try {
    const audit = await sendAuditMessage(manifestPath);
    if (!audit.passed) {
      // patching goes here
      console.log(audit.failed, 'failed shaIds')
      let copiesToRemoveFromManifest = []
      audit.failed.forEach((failedShaId, idx) => {
        console.log('failed sha from forEach loop', failedShaId)
        const siblingShardId = findRedundantShard(audit.data, failedShaId);
        copiesToRemoveFromManifest = copiesToRemoveFromManifest.concat(findFailedShardCopies(audit.data, failedShaId))
        if (siblingShardId) {
          const message = {
            messageType: "CLI_PATCH_FILE",
            manifestPath,
            failedShaId,
            siblingShardId,
            copiesToRemoveFromManifest
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

function displayFileList() {
  const manifestFolder = './manifest/';

  if (!fs.existsSync(manifestFolder)) {
    console.log(chalk.bold.cyan("You don't have a manifest folder"));
  } else {
    console.log(chalk.bold.cyan("You current file list: "));

    let manifestCount = 0;
    fs.readdirSync(manifestFolder).forEach(file => {
      if (!validManifestExt(file)) { return; };
      manifestCount +=1;

      const manifestFilePath = manifestFolder + file;
      const manifest = fileSystem.loadManifest(manifestFilePath);
      console.log('name: ' + manifest.fileName + '; manifest path: ' + manifestFilePath);
    });

    if (manifestCount === 0) {
      console.log(chalk.bold.red("No valid manifest files found"));
    }
  }
}

function validManifestExt(filePath) {
  const validExtention = '.batchain';
  return validExtention === path.extname(filePath);
}

if (batchain.list) {
  displayFileList();
} else if (batchain.upload) {

  client = cliNode.connect(CLI_SERVER.port, CLI_SERVER.host);

  console.log(chalk.yellow('You can only upload one file at a time'));

  if (!fs.existsSync(batchain.upload)) {
    console.log(chalk.red('You entered an invalid file path, please try again'));
  } else {
    console.log(chalk.yellow('Uploading file to the network'));
    sendUploadMessage();
  }

} else if (batchain.download) {
  client = cliNode.connect(CLI_SERVER.port, CLI_SERVER.host);

  console.log(chalk.yellow('You can only download one file at a time'));

  if (!fs.existsSync(batchain.download) || !validManifestExt(batchain.download)) {
    console.log(chalk.red('You entered an invalid manifest path, please try again'));
  } else {
    console.log(chalk.yellow('Downloading file to your local disk'));
    sendDownloadMessage();
  }

} else if (batchain.audit) {
  client = cliNode.connect(CLI_SERVER.port, CLI_SERVER.host);

  console.log(chalk.yellow('You can audit file to make sure file integrity'));

  if (!fs.existsSync(batchain.audit) || !validManifestExt(batchain.audit)) {
    console.log(chalk.red('You entered an invalid manifest path, please enter a valid file and try again'));
  } else {
    console.log(chalk.yellow('Starting file audit'));
    sendAuditMessage(batchain.audit);
  }
} else if (batchain.patch) {
  client = cliNode.connect(CLI_SERVER.port, CLI_SERVER.host);

  if (!fs.existsSync(batchain.patch) || !validManifestExt(batchain.patch)) {
   console.log(chalk.red('You entered an invalid manifest path, please enter a valid file and try again'));
  } else {
    console.log(chalk.yellow('Checking data redundancy levels for file'));
    sendPatchMessage(batchain.patch);
  }
} else if (batchain.sha) {
  console.log(chalk.yellow('Calculating SHA of file contents'));
  const fileSha = fileSystem.sha1Hash(batchain.sha);
  console.log(fileSha);
} else if (batchain.stellar){
  getStallerAccountInformation()
} else {
  console.log(chalk.bold.magenta("Hello, welcome to Batchain!"));
  console.log(chalk.bold.magenta("Please make sure you have started the server"));
}