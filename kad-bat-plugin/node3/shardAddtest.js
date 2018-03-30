const fileSystem = require('fs');
const crypto = require('crypto');
const zlib = require('zlib');
const algorithm = 'aes-256-cbc';
const path = require('path');
const dotenv = require('dotenv');
const fs = require('fs');

const assembleShards = (fileName, chunkIds) => {
  const chunkDir = './shards'
  const filePaths = chunkIds.map(chunkId => chunkDir + '/' + chunkId)
  
  const destinationDir = './personal'
  
  const fileDestination = destinationDir + '/' + fileName
  let writeStream = fileSystem.createWriteStream(fileDestination)
  
  filePaths.forEach(path => {
    let fileData = fileSystem.readFileSync(path)
    writeStream.write(fileData, function() {
      console.log("filePath: " + path + " size " + fs.statSync(path).size);
    });
  })
  writeStream.end(() => {
    console.log("final filePath: " + fileDestination + " size " + fs.statSync(fileDestination).size);
    // decrypt(fileDestination)
  })
}

const loadManifest = (manifestFilePath) => {
  const manifest = JSON.parse(fileSystem.readFileSync(manifestFilePath))
  return manifest
}

const getArrayOfShards = (manifestFilePath) => {
  return Object.keys(loadManifest(manifestFilePath).chunks)
}

const manifest = './manifest/f7951a9e7bf92e888a79788abc6abebfd374dcd6.batchain';
const chunkIds = getArrayOfShards(manifest);
const fileName = loadManifest(manifest).fileName;

assembleShards(fileName, chunkIds);