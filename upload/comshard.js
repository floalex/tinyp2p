const fs = require('fs');
const crypto = require('crypto');
const path = require('path');
const algorithm = 'aes-256-cbc';
const zlib = require('zlib');

// assume the manifest in user's local machine
// get the shards info from manifest file first, then assemble the shards
function composeShards(manifestFile) {
  const manifest = JSON.parse(fs.readFileSync(manifestFile));
  const chunkIds = manifest.chunks;
  
  // TODO: get the shards via iterativeFindValue and store the shards in local disk
  // - iterate through the chunkIds array
  //  - find the shard file based on chunkId(might need to use JS `startsWith`)
  //   - if the file hasn't existed yet (by comparing file id)
  //      - store the file 
  //      - shardSaved += 1
  
  // after getting all the shards (shardSaved === 10), might need to set the default number as constants
  assembleShards(manifest, chunkIds);
}

function assembleShards(manifest, chunkIds) {
  // get the shards folder directions after downloading all the 
  const chunkdir = './shards';
  const filePaths = chunkIds.map(chunkId => chunkdir + '/' + chunkId);

  const destDir = './downloads';
  if (!fs.existsSync(destDir)){ fs.mkdirSync(destDir); }
  
  const fileDes =  destDir + '/' + manifest.fileName;
  let writeStream = fs.createWriteStream(fileDes);
  
  filePaths.forEach(path => {
    writeStream.write(fs.readFileSync(path), function() {
      console.log("filePath: " + path + " size " + fs.statSync(path).size);
    });
  });

  // use end to signal no more data comes in
  writeStream.end( () => {
    console.log('The file has been saved, ready to be decrypted!');
    DecryptHelper(fileDes, manifest.fileName);
  });
}

const DecryptHelper = (function(filepath, fileName) {
  // Path to temporarily store decrypted version of file to be uploaded
  const temppath = 'decrypt' + path.parse(filepath).name;  // go back to original ext

  // get the file password from the previously designated secret file
  const secretpath = '../encrypt/' + fileName + 'secret.env';
  const password = fs.readFileSync(secretpath);

  // input file
  const r = fs.createReadStream(filepath);

  // decrypt content
  const decrypt = crypto.createDecipher(algorithm, password);
  // unzip content
  const unzip = zlib.createGunzip();
  // write file
  const w = fs.createWriteStream(temppath);

  // start pipe
  r.pipe(decrypt).pipe(unzip).pipe(w)
   .on('close', () => console.log("The file is fully encrypted"));
});

// const manifestFile = './manifest/shardtest.bat';
const manifestFile = './manifest/f03a2380644b6ea7477a8b0c50b2633b4f9ee396.bat';
composeShards(manifestFile);