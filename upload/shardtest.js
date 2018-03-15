const fs = require('fs');
const crypto = require('crypto');
const path = require('path');
const algorithm = 'aes-256-cbc';
// zip the large file
const zlib = require('zlib');

function generateHashId(fileData) {
  return crypto.createHash('sha1').update(fileData).digest('hex');
}

function addShardsToManifest(manifest, fileath) {
  const fileSize = manifest.fileSize;
  const setChunkNum = 10; // default Chunk number from SIA according to Reed-Solomon algorithm: https://blog.sia.tech/how-to-put-data-on-the-sia-network-784499a65b
  const chunkNumber = fileSize % setChunkNum === 0 ? setChunkNum : setChunkNum - 1;
  const chunkSize = Math.floor(fileSize/chunkNumber);
 
  const readable = fs.createReadStream(fileath);
  readable.on('readable', function() {
    let chunk;
    // readable.read() is called automatically until the internal buffer is fully drained
    // you  don't need remainder as the last chunkSize will equal to whatever bytes left
    while (null !== (chunk = readable.read(chunkSize))) {
      const chunkId = generateHashId(chunk);
      manifest.chunks.push(chunkId);
      // console.log(`Received ${chunk.length} bytes of data.`);
      // console.log(manifest.chunks.length);
    }
  });
  
  // File.open(file, "r") do |fh_in|
  //     until fh_in.eof?
  //       chunk = fh_in.read(shard_size)
  //       chunk_hash = generate_file_id(chunk)

  //       manifest[:chunks].push(chunk_hash)
  //       storeShards(chunk_hash, chunk) 
  //     end
  //   end
}

const manifest = {"fileName":"stream.pdf.crypt","fileSize":953504,"chunks":[]};
addShardsToManifest(manifest, '../encrypt/stream.pdf.crypt');