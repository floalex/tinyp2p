const tcpUtils = require('./utils/tcp').tcp;
const fileUtils = require('./utils/file').fileSystem;
const path = require('path');
const PERSONAL_DIR = require('./utils/file').PERSONAL_DIR;
const HOSTED_DIR = require('./utils/file').HOSTED_DIR;
const publicIp = require('public-ip');
const fs = require('fs');

class BatNode {
  constructor(kadenceNode = {}) {
    this._kadenceNode = kadenceNode;
    fileUtils.generateEnvFile()
  }

  // TCP server
  createServer(port, ip, connectionCallback, listenCallback){
    tcpUtils.createServer(port, ip, connectionCallback, listenCallback)
  }

  get address() {
    return this._address
  }

  set address(address) {
    this._address = address
  }

  get kadenceNode() {
    return this._kadenceNode
  }

  // TCP client
  connect(port, host, callback) {
    return tcpUtils.connect(port, host, callback) // Returns a net.Socket object that can be used to read and write
  }                                               // from the TCP stream

   // Send data as tcp client
  sendDataToNode(port, host, connectCallback, payload, respondToServer){
    let client = this.connect(port, host, connectCallback) // connect to the target server with an optional callback
                                                           // that executes when the connection is established
    client.on('data', (data) => { // event handler that is called when the server responds
      respondToServer(data)
    })

    client.write(payload) // sends data to the server through the TCP stream
  }

  // Read data from a file
  readFile(filePath, callback) {
    return fileUtils.getFile(filePath, callback)
  }
  writeFile(path, data, callback) {
    fileUtils.writeFile(path, data, callback)
  }

  sendFile(port, host, filepath, fileName) {
    this.readFile(filepath, (error, data) => {
      let payload = {
        messageType: "STORE_FILE",
        fileName,
        fileContent: data,
      }

      payload = JSON.stringify(payload)
    
      this.sendDataToNode(port, host, null, payload, null)
    })
  }
  // Send shards one at a time to only one node
  sendShardsToOneNode(port, host, shards){
    let shardIdx = 0
    let client = this.connect(port, host)

    client.on('data', (data) => {
      let serverResponse = JSON.parse(data).messageType
      console.log("Processing shard number: " + (shardIdx+1));
      if (shardIdx >= shards.length - 1){
        client.end();
      } else if (serverResponse === "SUCCESS" && shardIdx < shards.length - 1) {
        shardIdx += 1
        let message = {
          messageType: "STORE_FILE",
          fileName: shards[shardIdx],
          fileContent: fs.readFileSync(`./shards/${shards[shardIdx]}`)
        }
        client.write(JSON.stringify(message))
      }
    })

    let message = {
      messageType: "STORE_FILE",
      fileName: shards[shardIdx],
      fileContent: fs.readFileSync(`./shards/${shards[shardIdx]}`)
    }
    
    client.write(JSON.stringify(message))
    
    client.on('end', () => {
      console.log('upload end')
    })
  }
  
  // Send one shard copy to only one node
  sendOneCopyShard(port, host, shards, manifest){
    let shardIdx = 0
    let orgShardId = shards[shardIdx];
    let copyIdx = 0
    let client = this.connect(port, host)

    client.on('data', (data) => {
      let serverResponse = JSON.parse(data).messageType
      // console.log("Processing shard number: " + (shardIdx+1));
      if (shardIdx >= shards.length - 1){
        client.end();
      } else if (serverResponse === "SUCCESS" && shardIdx < shards.length - 1) {
        shardIdx += 1;
        orgShardId = shards[shardIdx];
        // console.log("Processing shard: " + manifest[orgShardId][copyIdx]);
        let message = {
          messageType: "STORE_FILE",
          fileName: manifest[orgShardId][copyIdx],
          fileContent: fs.readFileSync(`./shards/${orgShardId}`)
        }
        client.write(JSON.stringify(message))
      }
    })

    let message = {
      messageType: "STORE_FILE",
      fileName: manifest[orgShardId][copyIdx],
      fileContent: fs.readFileSync(`./shards/${orgShardId}`)
    }
    
    client.write(JSON.stringify(message))
    
  }
  
  sendShardToNode(nodeInfo, shard, shardIdx) {
    let { port, host } = nodeInfo;
    let client = this.connect(port, host);

    let message = {
      messageType: "STORE_FILE",
      fileName: shard,
      fileContent: fs.readFileSync(`./shards/${shard}`)
    };

    client.write(JSON.stringify(message));
    
    client.on('end', () => {
      console.log('upload end')
    })
  }
  
  sendShards(nodes, shards) {
    let shardIdx = 0;
    let nodeIdx = 0;
    while (shards.length > shardIdx) {
      let currentNodeInfo = nodes[nodeIdx];
      
      this.sendShardToNode(currentNodeInfo, shards[shardIdx], shardIdx);

      shardIdx += 1;
      nodeIdx = this.nextNodeIdx(nodeIdx, shardIdx, nodes.length, shards.length);
    }
  }
  
  nextNodeIdx(nodeIdx, shardIdx, nodesCount, shardsCount) {
    
    let atTailNode = (nodeIdx + 1 === nodesCount);
    let remainingShards = (shardIdx + 1 <= shardsCount);  //TODO need to ad to next master branch
    
    console.log("current nodeIdx: " + nodeIdx);
    console.log("shardIdx: " + shardIdx);
    console.log("remainingShards: " + remainingShards);
    console.log("atTailNode: " + atTailNode);

    nodeIdx = (atTailNode && remainingShards) ? 0 : nodeIdx + 1;
    
    console.log("next nodeIdx: " + nodeIdx);
    return nodeIdx;
  }
  
  // Upload file will process the file then send it to the target node
  // uploadFileToOneNode(post, host, filePath){
  uploadFile(filePath){
    // Encrypt file and generate manifest
    const fileName = path.parse(filePath).base
    
    // change from hardcoded values to a method uploadDestinationNodes later
    const destinationNodes = [
      { host: '127.0.0.1' , port: 1237 },
      { host: '127.0.0.1' , port: 1238 }
    ];

    fileUtils.processUpload(filePath, (manifestPath) => {
      const shardsOfManifest = fileUtils.getArrayOfShards(manifestPath)
      
      const manifest = fileUtils.loadManifest(manifestPath);
      
      // this.sendOneCopyShard(port, host, shardsOfManifest, manifest);

      // this.sendShardsToOneNode(port, host, shardsOfManifest);
      
      this.sendShards(destinationNodes, shardsOfManifest);
    })
  }

  // Write data to a file in the filesystem. In the future, we will check the
  // file manifest to determine which directory should hold the file.
  receiveFile(payload) {
    let fileName = payload.fileName
    let fileContent = new Buffer(payload.fileContent)
    this.writeFile(`./${HOSTED_DIR}/${fileName}`, fileContent, (err) => {
      if (err) {
        console.log("Error!");
        throw err;
      }
    });
  }

  retrieveFileFromOneNode(manifestFilePath, port, host, retrievalCallback){
    let client = this.connect(port, host)
    let manifest = fileUtils.loadManifest(manifestFilePath)

    const shards = manifest.chunks
    const fileName = manifest.fileName
    let size = manifest.fileSize
    let retrievedFileStream = fs.createWriteStream(`./personal/${fileName}`)
    let currentShard = 0

    let request = {
      messageType: "RETRIEVE_FILE",
      fileName: shards[currentShard],
    }

    client.on('data', (data) => {
      size -= data.byteLength
      console.log(data.byteLength)
      retrievedFileStream.write(data)
      if (size <= 0){
        client.end()
      } else {
        currentShard += 1
        let request = {
          messageType: "RETRIEVE_FILE",
          fileName: shards[currentShard]
        }
        client.write(JSON.stringify(request))
      }
    })

    client.write(JSON.stringify(request))

    client.on('end', () => {
      console.log('end')
      fileUtils.decrypt(`./personal/${fileName}`)
    })
  }
  
  retrieveFile(manifestFilePath, retrievalCallback) {
    let manifest = fileUtils.loadManifest(manifestFilePath);
    const shards = manifest.chunks;
    const fileName = manifest.fileName;
    let shardsTracker = { index: 0, written: 0, total: shards.length };
    // hardcoded 8 fileId + node contact info retrieved via find value RPC process.
    const shardLocationData = [
      [ "8348efe491e42e6d6458b649d3e6975478b8a8d8", { host: '127.0.0.1', port: 1237 }],
      [ "6c24e2dc2ae611e9c4f106faddaeafb8b3ed573e", { host: '127.0.0.1', port: 1238 }],
      [ "a156c1825266fdca7f3ab1343b7fecd419bb182d", { host: '127.0.0.1', port: 1237 }],
      [ "9beee5923959aa8f0b1b10c352f52246d5d2cea0", { host: '127.0.0.1', port: 1238 }],
      [ "b5adfb72313ac7c728e8cf14ec3e10124cebfece", { host: '127.0.0.1', port: 1237 }],
      [ "b18cd84073f39eb4a09244ef9fc1956b23cb748f", { host: '127.0.0.1', port: 1238 }],
      [ "a11d8089660d1cde3ba883b40fa673f8a6ccb961", { host: '127.0.0.1', port: 1237 }],
      [ "7cea3ebbd2ecc5ec45b65f42047044a731e85fa4", { host: '127.0.0.1', port: 1238 }]
    ];

    while (shardsTracker.index < shardLocationData.length) {
      this.retrieveShard(shardLocationData, shardsTracker, shards, manifest.fileName);
      shardsTracker.index += 1;
    }
  }

  retrieveShard(shardLocationData, shardsTracker, shards, fileName) {
    let currentShardInfo = shardLocationData[shardsTracker.index][1];
    let client = this.connect(currentShardInfo.port, currentShardInfo.host);
    let shardId = shardLocationData[shardsTracker.index][0];
    let request = {
      messageType: "RETRIEVE_FILE",
      fileName: shardId,
    };

    client.write(JSON.stringify(request), (err) => {
      if (err) { console.log('Write err! ', err); }
    });

    client.on('data', (data) => {
      // Write retrieved data to a local shard file
      fs.writeFile(`./shards/${shardId}`, data, 'utf8', () => {
        client.end();
      });
    });

    client.on('end', () => {
      shardsTracker.written += 1;
      // what do we do if all shards are never received?
      if (shardsTracker.written == shardsTracker.total) {
        fileUtils.assembleShards(fileName, shards);
      }
    });
  };
}

exports.BatNode = BatNode;