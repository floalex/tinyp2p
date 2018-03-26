const fileSystem = require('fs');
const crypto = require('crypto');
const zlib = require('zlib');
const algorithm = 'aes-256-cbc';
const path = require('path');
const dotenv = require('dotenv');

const sha1Hash = (file) => {
  const fileData = fileSystem.readFileSync(file)
  return sha1HashData(fileData)
}

const sha1HashData = (fileData) => {
  return crypto.createHash('sha1').update(fileData).digest('hex')
}

const file = '../node1/hosted/9e15ba72e497282bc98eff4640f174be47466d9d';
console.log(sha1Hash(file));