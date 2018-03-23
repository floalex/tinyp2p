const fs = require('fs');
const crypto = require('crypto');
const path = require('path');
const algorithm = 'aes-256-cbc';
// zip the large file
const zlib = require('zlib');

function sha1HashContent(fileData) {
  return crypto.createHash('sha1').update(fileData).digest('hex');
}

function addShardsToManifest(manifest, filePath, manifestName, dir, callback) {
  const fileSize = manifest.fileSize;
  const setChunkNum = 10; // default Chunk number from SIA: https://blog.sia.tech/how-to-put-data-on-the-sia-network-784499a65b
  const chunkNumber = fileSize % setChunkNum === 0 ? setChunkNum : setChunkNum - 1;
  const chunkSize = Math.floor(fileSize/chunkNumber);
 
  const readStream = fs.createReadStream(filePath);
  // use Event: 'readable', the 'readable' event indicates that the stream has new information
  readStream.on('readable', function() {
    let chunk;
    // readable.read() is called automatically until the internal buffer is fully drained
    // you don't need remainder as the last chunkSize will equal to whatever bytes left
    while (null !== (chunk = readStream.read(chunkSize))) {
      const chunkId = sha1HashContent(chunk);
      manifest.chunks[chunkId] = [];
      // manifest.chunks.push(chunkId);
      // console.log(`Received ${chunk.length} bytes of data.`);
      // console.log(manifest.chunks.length);
      
      storeShards(chunk, chunkId);
      copyShards(chunk, chunkId, manifest);
    }
  });
  readStream.on('end', () => {
    // fileSystem.writeFile(`${dir}/${manifestName}`, JSON.stringify(manifest), () => {
    //     callback(`${dir}/${manifestName}`)
    //   });
    
    // pass in `null, '\t'` in stringify make JSON file more readable
    writeToFolder(dir, manifestName, JSON.stringify(manifest, null, '\t'), function() {
      console.log('The manifest file has been saved!');
    });
  });
}

function copyShards(chunk, chunkId, manifest) {
  // for chunkId 1 to 10
  //  manifest[chunkId] = [];
  //  - 3(or other number) times
  //    - copyId = copy chunk+random 2-byte
  //    - manifest[chunkId].push(copyId)
  //  manifest.chunkId.forEach(copyId)
  //    filePath = './shards' + '/' + chunkId
  //    iterativeStore(copyId, filePath);
  const copyNum = 3; 
  let copyShardContent;
  let appendBytes;
  let copyChunkId;

  // manifest[chunkId] = [];
  
  for (let i = 1; i <= copyNum; i++) {
    appendBytes = crypto.randomBytes(2).toString('hex');
    copyShardContent = chunk + appendBytes;
    // console.log(`Copy chunk has ${copyShardContent.length} bytes of data.`);
    
    copyChunkId = sha1HashContent(copyShardContent);
    manifest.chunks[chunkId].push(copyChunkId);
    // manifest[chunkId].push(copyChunkId);
  }
  
  // console.log(chunkId + ": " + manifest[chunkId]);  
}

function storeShards(chunk, chunkId) {
  const dir = './shards';

  if (!fs.existsSync(dir)){ fs.mkdirSync(dir); }
  
  const filePath = dir + '/' + chunkId;
  
  // writeToFolder(dir, chunkId, chunk);

  writeToFolder(dir, chunkId, chunk, function(err) {
    if (err) throw err;
    console.log("filePath: " + filePath + " size " + fs.statSync(filePath).size);
  });
    
  // add_to_cache(@shards, name, file_path)
  // iterative_store(name, file_url(file_path))
}

function writeToFolder(dir, filename, filecontent, callback) {
  return fs.writeFile(`${dir}/${filename}`, filecontent, callback);
}

// const manifest = {"fileName":"stream.pdf.crypt","fileSize":953504,"chunks":[]};
const manifest = {"fileName":"cat.jpg.crypt","fileSize":41904,"chunks":{}};

addShardsToManifest(manifest, '../encrypt/cat.jpg.crypt', 'shardtest.bat', './manifest');