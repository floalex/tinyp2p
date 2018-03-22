const fs = require('fs');
const crypto = require('crypto');
const path = require('path');
const algorithm = 'aes-256-cbc';
// zip the large file
const zlib = require('zlib');

function sha1Hash(file) {
  // doesn't work with `readFile`, get `undefined` for fileData
  // const fileData = fs.readFile(file, (err, data) => {
  //   if (err) throw err;
  //   console.log(data);
  // });
  const fileData = fs.readFileSync(file);
  return sha1HashData(fileData);
}

function sha1HashData(fileData) {
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
      const chunkId = sha1HashData(chunk);
      manifest.chunks.push(chunkId);
      // console.log(`Received ${chunk.length} bytes of data.`);
      // console.log(manifest.chunks.length);
      
      copyShards(chunk, chunkId, manifest);
      
      storeShards(chunk, chunkId);
    }
  });
  readStream.on('end', () => {
    writeToFolder(dir, manifestName, JSON.stringify(manifest, null, '\t'), function() {
      console.log('The manifest file has been saved!');
    });
    
    // fileSystem.writeFile(`${dir}/${manifestName}`, JSON.stringify(manifest), () => {
    //     callback(`${dir}/${manifestName}`)
    //   });
    
    // pass in `null, '\t'` in stringify make JSON file more readable
  });
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
  
  manifest[chunkId] = [];
  
  for (let i = 1; i <= copyNum; i++) {
    appendBytes = crypto.randomBytes(2).toString('hex');
    copyShardContent = chunk + appendBytes;
    // console.log(`Copy chunk has ${copyShardContent.length} bytes of data.`);
    
    const copyChunkId = sha1HashData(copyShardContent);
    manifest[chunkId].push(copyChunkId);
  }
  
  // console.log(chunkId + ": " + manifest[chunkId]);
    
}


function writeToFolder(dir, filename, filecontent, callback) {
  return fs.writeFile(`${dir}/${filename}`, filecontent, callback);
}

function generateManifest(filename, filesize) {
  return { fileName: filename, fileSize: filesize, chunks: [] }; //TODO: Add copies 
}

function addManifestToFile(file, hashId, callback) {
  const sizeInByte = fs.statSync(file).size;
  const filename = path.basename(file);
  const manifest = generateManifest(filename, sizeInByte);

  const manifestName = hashId + '.bat';
  const dir = './manifest';

  if (!fs.existsSync(dir)){
    fs.mkdirSync(dir);
  }
  
  addShardsToManifest(manifest, file, manifestName, dir, callback);
}

const encrypt = (function(filepath, callback) {
  // Path to temporarily store encrypted version of file to be uploaded
  const tmppath = './' + filepath + '.crypt';

  // create a password for the encrypt file
  const password = crypto.randomBytes(32).toString('hex');
  console.log(
    `Please save: ${password.length} bytes of random password: ${password}`);

  // save the password to a secret file
  const secretpath = tmppath +'secret.env';
  // write the password in the secret file
  fs.writeFile(secretpath, password, (err) => {
    if (err) throw err;
    console.log('The secret file has been saved!');
  });

  // input file, turn it into a new ReadStream object then we can use readable.pipe
  const r = fs.createReadStream(filepath);
  // zip content
  const zip = zlib.createGzip();
  // encrypt content
  const encrypt = crypto.createCipher(algorithm, password);

  // write encrypted file
  const w = fs.createWriteStream(tmppath);

  // start pipe, stream to write encrypted
  
  r.pipe(zip).pipe(encrypt).pipe(w).on('close', function() {
    console.log("The file is fully encrypted, generating manifest");
    // const file = tmppath;
    // const hash = sha1Hash(file);
    // addManifestToFile(file, hash);
    callback(tmppath);
  });

});

const processUpload = (filePath) => {
  encrypt(filePath, (encryptedFilePath) => {
    const hash = sha1Hash(encryptedFilePath);
    addManifestToFile(encryptedFilePath, hash);
  });
};

// const filename = '../encrypt/test.pdf';
const filename = '../encrypt/cat.jpg';

processUpload(filename);