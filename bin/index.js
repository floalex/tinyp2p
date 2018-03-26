#!/usr/bin/env node

'use strict';

const batchain = require('commander');
const chalk = require('chalk');

// const BatNode = require('../batnode').BatNode;
const PERSONAL_DIR = require('../utils/file').PERSONAL_DIR;
const HOSTED_DIR = require('../utils/file').HOSTED_DIR;
const fileSystem = require('../utils/file').fileSystem;
const fs = require('fs');

batchain
  .command('sample', 'kad nodes connect with bat nodes')
  .command('localsample', 'see the local sample nodes running')
  .option('-l, --list', 'view your list of uploaded files in BatChain network')
  .parse(process.argv);

if (batchain.list) {
  console.log(chalk.bold.cyan("You current file list: "));
  
  const manifestFolder = './manifest/';

  fs.readdirSync(manifestFolder).forEach(file => {
    const manifestFilePath = manifestFolder + file;
    const manifest = fileSystem.loadManifest(manifestFilePath);
    console.log('name: ' + manifest.fileName + '; manifest path: ' + manifestFilePath);
  });
}
