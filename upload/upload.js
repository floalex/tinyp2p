const fs = require('fs');
const crypto = require('crypto');
const path = require('path');
const algorithm = 'aes-256-cbc';
// zip the large file
const zlib = require('zlib');
// const encryptor = require('../encrypt/encrypt.js');

function sha1Hash(file) {
  // doesn't work with `readFile`, get `undefined` for fileData
  // const fileData = fs.readFile(file, (err, data) => {
  //   if (err) throw err;
  //   console.log(data);
  // });
  const fileData = fs.readFileSync(file);
  return sha1HashContent(fileData);
}

function sha1HashContent(fileData) {
  return crypto.createHash('sha1').update(fileData).digest('hex');
}

function addShardsToManifest(manifest, fileath, manifestName, dir) {
  const fileSize = manifest.fileSize;
  const setChunkNum = 10; // default Chunk number from SIA according to Reed-Solomon algorithm: https://blog.sia.tech/how-to-put-data-on-the-sia-network-784499a65b
  const chunkNumber = fileSize % setChunkNum === 0 ? setChunkNum : setChunkNum - 1;
  const chunkSize = Math.floor(fileSize/chunkNumber);
 
  const readable = fs.createReadStream(fileath);
  readable.on('readable', () => {
    let chunk;
    // readable.read() is called automatically until the internal buffer is fully drained
    // you  don't need remainder as the last chunkSize will equal to whatever bytes left
    while (null !== (chunk = readable.read(chunkSize))) {
      const chunkId = sha1HashContent(chunk);
      manifest.chunks.push(chunkId);
      // console.log(`Received ${chunk.length} bytes of data.`);
      // console.log(manifest.chunks.length);
    }
  });
  readable.on('end', () => {
     return fs.writeFile(`${dir}/${manifestName}`, JSON.stringify(manifest), (err) => {
      if (err) throw err;
      console.log('The manifest file has been saved!');
    });
  });
}

function generateManifest(filename, filesize) {
  return { fileName: filename, fileSize: filesize, chunks: [] };
}

function addManifestToFile(file, hashId) {
  const sizeInByte = fs.statSync(file).size;
  const filename = path.basename(file);
  const manifest = generateManifest(filename, sizeInByte);

  const manifestName = hashId + '.bat';
  const dir = './manifest';

  if (!fs.existsSync(dir)){
    fs.mkdirSync(dir);
  }
  
  addShardsToManifest(manifest, file, manifestName, dir);
}

function storeShards(name, data) {
    // file_path = '/shards/' + name

    // write_to_subfolder(Defaults::ENVIRONMENT[:shards], name, data)
    // add_to_cache(@shards, name, file_path)
    // iterative_store(name, file_url(file_path))
}

const EncryptUploadHelper = (function(filepath) {
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
    const file = tmppath;
    const hash = sha1Hash(file);
    addManifestToFile(file, hash);
  });

});

const filename = '../encrypt/stream.pdf';

EncryptUploadHelper(filename);