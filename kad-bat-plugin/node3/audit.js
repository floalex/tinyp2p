const fs = require('fs');
const crypto = require('crypto');
const zlib = require('zlib');
const algorithm = 'aes-256-cbc';
const path = require('path');
const dotenv = require('dotenv');

const sha1Hash = (file) => {
  const fileData = fs.readFileSync(file)
  return sha1HashData(fileData)
}

const sha1HashData = (fileData) => {
  return crypto.createHash('sha1').update(fileData).digest('hex')
}

const file = '../node1/hosted/8b535cb7659db6730e11409a7f0cce38bcceda35';
console.log(fs.statSync(file).size);
console.log(sha1Hash(file));