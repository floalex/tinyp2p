const tcpUtils = require('../utils/tcp').tcp;
const fileUtils = require('../utils/file').fileSystem;
const path = require('path');
const PERSONAL_DIR = require('../utils/file').PERSONAL_DIR;
const HOSTED_DIR = require('../utils/file').HOSTED_DIR;
const publicIp = require('public-ip');
const fs = require('fs');
const JSONStream = require('JSONStream');

class BatNode {
  constructor(kadenceNode = {}) {
    this._kadenceNode = kadenceNode;
    fileUtils.generateEnvFile()
  }

  // TCP server
  createServer(port, host, connectionCallback){
    const listenCallback = (server) => {
      this._server = server
    }
    let server = tcpUtils.createServer(port, host, connectionCallback, listenCallback)
    this.address = {port, host}
  }

  createCLIServer(port, host, connectionCallback) {
    tcpUtils.createServer(port, host, connectionCallback);
  }

  get server(){
    return this._server
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

  // Read data from a file
  readFile(filePath, callback) {
    return fileUtils.getFile(filePath, callback)
  }
  writeFile(path, data, callback) {
    fileUtils.writeFile(path, data, callback)
  }

  sendShardToNode(nodeInfo, shard, shards, shardIdx, storedShardName, distinctIdx, manifestPath) {
    let { port, host } = nodeInfo;
    let client = this.connect(port, host, () => {
      console.log('connected to target batnode')
    });

    let message = {
      messageType: "STORE_FILE",
      fileName: shard,
      fileContent: fs.readFileSync(`./shards/${storedShardName}`)
    };

    client.on('data', (data) => {
      console.log('received data from server')
      if (shardIdx < shards.length - 1){
        this.getClosestBatNodeToShard(shards[shardIdx + 1], (batNode) => {
          this.sendShardToNode(batNode, shards[shardIdx + 1], shards, shardIdx + 1, storedShardName, distinctIdx, manifestPath)
        })
      } else {
        this.distributeCopies(distinctIdx + 1, manifestPath)
      }
    })

    client.write(JSON.stringify(message), () => {
      console.log('sent data to server!', port, host)
    });
  }

  // Upload file will process the file then send it to the target node
  uploadFile(filePath, distinctIdx = 0) {
    // Encrypt file and generate manifest
    const fileName = path.parse(filePath).base
    console.log("upload file name: ", fileName);
    fileUtils.processUpload(filePath, (manifestPath) => {
     this.distributeCopies(distinctIdx, manifestPath)
    });
  }

  distributeCopies(distinctIdx, manifestPath, copyIdx = 0){
    const shardsOfManifest = fileUtils.getArrayOfShards(manifestPath)
    if (distinctIdx < shardsOfManifest.length) {
      const manifest = JSON.parse(fs.readFileSync(manifestPath))
      let copiesOfCurrentShard = manifest.chunks[shardsOfManifest[distinctIdx]]
      
      console.log("copiesOfCurrentShard: ", copiesOfCurrentShard);
      this.getClosestBatNodeToShard(copiesOfCurrentShard[copyIdx],  (batNode) => {
        this.sendShardToNode(batNode, copiesOfCurrentShard[copyIdx], copiesOfCurrentShard, copyIdx, shardsOfManifest[distinctIdx], distinctIdx, manifestPath)
      });
    }
  }

  getClosestBatNodeToShard(shardId, callback){
    this.kadenceNode.iterativeFindNode(shardId, (err, res) => {
      let i = 0
      let targetKadNode = res[0]; // res is an array of these tuples: [id, {hostname, port}]
      while (targetKadNode[1].hostname === this.kadenceNode.contact.hostname &&
            targetKadNode[1].port === this.kadenceNode.contact.port) { // change to identity and re-test
        i += 1
        targetKadNode = res[i]
      }

      this.kadenceNode.ping(targetKadNode, (error) => { // Checks whether target kad node is alive
        if (error) {
          this.getClosestBatNodeToShard(shardId, callback) // if it's offline, re-calls method. This works because sendign RPCs to disconnected nodes
        } else {                                          // will automatically remove the dead node's contact info from sending node's routing table
          this.kadenceNode.getOtherBatNodeContact(targetKadNode, (error2, result) => { // res is contact info of batnode {port, host}
            callback(result)
          })
        }
      })
    })
  }

  // Write data to a file in the filesystem. In the future, we will check the
  // file manifest to determine which directory should hold the file.
  receiveFile(payload) {
    let fileName = payload.fileName
    this.kadenceNode.iterativeStore(fileName, this.kadenceNode.contact, () => {
      console.log('store completed')
      let fileContent = new Buffer(payload.fileContent)
      this.writeFile(`./${HOSTED_DIR}/${fileName}`, fileContent, (err) => {
        if (err) {
          throw err;
        }
      })
    })
  }

  retrieveFile(manifestFilePath, copyIdx = 0, distinctIdx = 0) {
    let manifest = fileUtils.loadManifest(manifestFilePath);
    const distinctShards = fileUtils.getArrayOfShards(manifestFilePath)
    const fileName = manifest.fileName;
    console.log("retrieveFile name: ", fileName);
    this.retrieveSingleCopy(distinctShards, manifest.chunks, fileName, manifest, distinctIdx, copyIdx)
  }

  retrieveSingleCopy(distinctShards, allShards, fileName, manifest, distinctIdx, copyIdx){
    console.log("distinctIdx before afterHostNode: ", distinctIdx);
    if (copyIdx && copyIdx > 2) {
      console.log('Host could not be found with the correct shard')
    } else {
      let currentCopies = allShards[distinctShards[distinctIdx]] // array of copy Ids for current shard
      let currentCopy = currentCopies[copyIdx]
            
      const afterHostNodeIsFound = (hostBatNode) => {
        console.log("hostBatNode: ", hostBatNode);
        if (hostBatNode[0] === 'false'){
          this.retrieveSingleCopy(distinctShards, allShards, fileName, manifest, distinctIdx, copyIdx + 1)
        } else {
          let retrieveOptions = {
            saveShardAs: distinctShards[distinctIdx],
            distinctShards,
            fileName,
            distinctIdx,
          }
          
          console.log("distinctIdx in afterHostNode: ", distinctIdx);
          
          // console.log("afterHostNode: ", hostBatNode);
          this.issueRetrieveShardRequest(currentCopy, hostBatNode, manifest, retrieveOptions, () => {
            this.retrieveSingleCopy(distinctShards, allShards, fileName, manifest, distinctIdx + 1, copyIdx)
          })
        }
      }
      
      console.log("currentCopy: ", currentCopy);
      console.log("distinctIdx: ", distinctIdx);
      
      this.getHostNode(currentCopy, afterHostNodeIsFound)
    }
  }

  issueRetrieveShardRequest(shardId, hostBatNode, manifest, options, finishCallback){
   let { saveShardAs, distinctIdx, distinctShards, fileName } = options
   
   const completeFileSize = manifest.fileSize;
   let chunkLengh = 0;
    
   const client = this.connect(hostBatNode.port, hostBatNode.host, () => {
    // console.log('connected to host batnode: ?', hostBatNode);
   
    const message = {
      messageType: 'RETRIEVE_FILE',
      fileName: shardId
    };
    
    client.write(JSON.stringify(message), () => {
      console.log("retriving distinctIdx: ", distinctIdx);
      // console.log('retrieve data from server!')
    });
    
    const fileDestination = './shards/' + saveShardAs;
    let shardStream = fs.createWriteStream(fileDestination);
    
    // https://gist.github.com/wesbos/1866f918824936ffb73d8fd0b02879b4
    // async function combineShards() {
    //   await writeChunkToDisk();
    //   fileUtils.assembleShards(fileName, distinctShards);
    // }
    
    // const writeChunkToDisk = () => {
    //   new Promise((resolve) => {
    //     client.once('data', (data) => {
    //       shardStream.write(data);
    //       client.pipe(shardStream);
    //       if (distinctIdx < distinctShards.length - 1){
    //         finishCallback()
    //       } else {
    //         resolve();
    //       }
    //     });
    //   });
    // }
    
    // combineShards();
    
    
    // https://stackoverflow.com/questions/20629893/node-js-socket-pipe-method-does-not-pipe-last-packet-to-the-http-response
    
    let waitTime = Math.floor(completeFileSize/20000);  // set the amount slightly above 16kb ~ 16384 (the default high watermark for read/write streams)
    console.log("waiting time in ms: ", waitTime);
    
    client.once('data', (data) => {
      
      shardStream.write(data);
     
      // read all file and pipe it (write it) to the fileDestination 
      client.pipe(shardStream);
      
      if ((distinctIdx >= distinctShards.length - 1)){
        // fileUtils.assembleShards(fileName, distinctShards);
        setTimeout(() => {fileUtils.assembleShards(fileName, distinctShards);}, waitTime);
      } else {          
        finishCallback();
      } 
      
      // still works by putting down here 
      // client.pipe(shardStream);
    
    });

   });
   
  }

  getHostNode(shardId, callback){
    this.kadenceNode.iterativeFindValue(shardId, (err, value, responder) => {
      // console.log("hostNode shard: ", shardId);
      let kadNodeTarget = value.value;
      console.log("kadNodeTarget: ", kadNodeTarget);
      this.kadenceNode.getOtherBatNodeContact(kadNodeTarget, (err, batNode) => {
        // console.log('kadNodeTarget: ', kadNodeTarget);
        console.log('getHostNode batnode: ', batNode);
        callback(batNode)
      })
    })
  }

  auditFile(manifestFilePath) {
    const manifest = fileUtils.loadManifest(manifestFilePath);
    const shards = manifest.chunks;
    const shaIds = Object.keys(shards);
    const fileName = manifest.fileName;
    let shaIdx = 0;

    const shardAuditData = shaIds.reduce((acc, shaId) => {
      acc[shaId] = {};

      shards[shaId].forEach((shardId) => {
        acc[shaId][shardId] = false;
      });

      return acc;
    }, {});

    while (shaIds.length > shaIdx) {
      this.auditShardsGroup(shards, shaIds, shaIdx, shardAuditData);
      shaIdx += 1;
    }
  }
  /**
   * Tests the redudant copies of the original shard for data integrity.
   * @param {shards} Object - Shard content SHA keys with
   * array of redundant shard ids
   * @param {shaIdx} Number - Index of the current
   * @param {shardAuditData} Object - same as shards param except instead of an
   * array of shard ids it's an object of shard ids and their audit status
  */
  auditShardsGroup(shards, shaIds, shaIdx, shardAuditData) {
    let shardDupIdx = 0;
    let duplicatesAudited = 0;
    const shaId = shaIds[shaIdx];

    while (shards[shaId].length > shardDupIdx) {
      this.auditShard(shards, shardDupIdx, shaId, shaIdx, shardAuditData);
      shardDupIdx += 1;
    }
  }

  auditShard(shards, shardDupIdx, shaId, shaIdx, shardAuditData) {
    const shardId = shards[shaId][shardDupIdx];

    this.kadenceNode.iterativeFindValue(shardId, (err, value, responder) => {
      let kadNodeTarget = value.value;
      this.kadenceNode.getOtherBatNodeContact(kadNodeTarget, (err, batNode) => {
        this.auditShardData(batNode, shards, shaIdx, shardDupIdx, shardAuditData)
      })
    })
  }

  auditShardData(targetBatNode, shards, shaIdx, shardDupIdx, shardAuditData) {
    let client = this.connect(targetBatNode.port, targetBatNode.host);

    const shaKeys = Object.keys(shards);
    const shaId = shaKeys[shaIdx];
    const shardId = shards[shaId][shardDupIdx]; // id of a redundant shard for shaId

    const finalShaGroup = shaKeys.length - 1 === shaIdx;
    const finalShard = shards[shaId].length - 1 === shardDupIdx;

    let message = {
      messageType: "AUDIT_FILE",
      fileName: shardId
    };

    client.write(JSON.stringify(message), (err) => {
      if (err) { throw err; }
    })

    client.on('data', (data) => {
      const hostShardSha1 = data.toString('utf8');
      // Check that shard content matches original content SHA
      if (hostShardSha1 === shaId) {
        shardAuditData[shaId][shardId] = true;
      }

      if (finalShaGroup && finalShard) {
        this.auditResults(shardAuditData, shaKeys);
      }
    })
  }

  auditResults(shardAuditData, shaKeys) {
    const dataValid = shaKeys.every((shaId) => {
      // For each key in the values object for the shaId key
      return Object.keys(shardAuditData[shaId]).every((shardId) => {
        return shardAuditData[shaId][shardId] === true;
      })
    });
    console.log(shardAuditData);
    if (dataValid) {
      console.log('Passed audit!');
    } else {
      console.log('Failed Audit');
    }
  }

}

exports.BatNode = BatNode;

// Upload w/ copy shards
// Input Data structure: object, keys are the stored filename, value is an array of IDS to associate
// with the content of this filename
// Given a file with the name of <key>, 
// For each <value id>, read that file's contents and distribute its contents to the
// appropriate node with the fileName property set to <value id>

// Retrieve w/ copy shards
// Input data structure: object, keys are the filename to write to, values are arrays of viable shard duplicate ids
// For each key,
// Make a request for the first value in the array


  // Edge cases for retrieval
  // File has been modified - check for file integrity before saving
  // Bat node is not responsive - done
  // File is not found on batnode

  // Edge cases for upload
  // Batnode is not responsive
