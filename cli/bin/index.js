#!/usr/bin/env node

'use strict';

const batchain = require('commander');

const BatNode = require('../batnode').BatNode;
const PERSONAL_DIR = require('../utils/file').PERSONAL_DIR;
const HOSTED_DIR = require('../utils/file').HOSTED_DIR;
const fileSystem = require('../utils/file').fileSystem;

batchain 
  .command('sample', 'see the sample nodes running')
  .parse(process.argv);
