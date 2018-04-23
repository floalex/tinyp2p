const bunyan = require('bunyan');
const levelup = require('levelup');
const leveldown = require('leveldown');
const encoding = require('encoding-down');
const kad = require('@kadenceproject/kadence');
const BatNode = require('../batnode.js').BatNode;
const kad_bat = require('../kadence_plugin').kad_bat;
const seed = require('../../constants').LOCALSEED_NODE;
const fileUtils = require('../../utils/file').fileSystem;
const JSONStream = require('JSONStream');
const stellar_account = require('../kadence_plugin').stellar_account;
const backoff = require('backoff');
const fs = require('fs');
//console.log(seed)

// Create second batnode kadnode pair

kadnode2 = new kad.KademliaNode({
      transport: new kad.HTTPTransport(),
      storage: levelup(encoding(leveldown('./dbb'))),
      contact: { hostname: 'localhost', port: 9000 }
    })
    
    // Set up
    kadnode2.plugin(kad_bat)
    kadnode2.listen(9000)
    kadnode2.plugin(stellar_account);
    const batnode2 = new BatNode(kadnode2)
    kadnode2.batNode = batnode2
    
    
    const nodeConnectionCallback = (serverConnection) => {
      const sendAuditDataWhenFinished = (exponentialBackoff) => {
        exponentialBackoff.failAfter(10);
        exponentialBackoff.on('backoff', function(number, delay) {
          console.log(number + ' ' + delay + 'ms');
        });
        exponentialBackoff.on('ready', function() {
          if (!batnode2.audit.ready) {
            exponentialBackoff.backoff();
          } else {
            serverConnection.write(JSON.stringify(batnode2.audit));
            return;
          }
        });
        exponentialBackoff.on('fail', function() {
          console.log('Timeout: failed to complete audit');
        });
        exponentialBackoff.backoff();
      }
    
      serverConnection.on('end', () => {
        console.log('end')
      })
      
      const stream = JSONStream.parse();
      serverConnection.pipe(stream);
    
      stream.on('data', (receivedData, error) => {
        if (receivedData.messageType === "RETRIEVE_FILE") {
          console.log("node 2 receivedData: ", receivedData); 
          const filePath = './hosted/' + receivedData.fileName;
          const readable = fs.createReadStream(filePath);
          readable.on('data', (chunk) => {
            serverConnection.write(chunk);
          });
      
          readable.on('end', () => {
            console.log(`finish sending ${receivedData.fileName}`)
          });
        } else if (receivedData.messageType === "STORE_FILE"){
          let fileName = receivedData.fileName
          // console.log("fileName: ", fileName);
          // without `iterativeStore`, uploader will get error when retrieve file
          batnode2.kadenceNode.iterativeStore(fileName, [batnode2.kadenceNode.identity.toString(), batnode2.kadenceNode.contact], (err, stored) => {
        // console.log('nodes who stored this value: ', stored)
          let fileContent = new Buffer(receivedData.fileContent);
          let storeStream = fs.createWriteStream("./hosted/" + fileName);
          storeStream.write(fileContent, function (err) {
            if(err){
              throw err;
            }
            serverConnection.write(JSON.stringify({messageType: "SUCCESS"}));
          });
        })
      } else if (receivedData.messageType === "AUDIT_FILE") {
        const shardFile = './hosted/' + receivedData.fileName;
        if (!fs.existsSync(shardFile)) { 
          serverConnection.write("failed");
        } else {
          batnode2.readFile(shardFile, (err, data) => {
            const shardSha1 = fileUtils.sha1HashData(data);
            console.log("shard: ", shardSha1);
            serverConnection.write(shardSha1);
          });
        }
      } else if (receivedData.messageType === "PATCH_FILE") {
        console.log("node 2 receivedData: ", receivedData); 
        const filePath = './hosted/' + receivedData.fileName;
        const readable = fs.createReadStream(filePath);
        readable.on('data', (chunk) => {
          serverConnection.write(chunk);
        });
    
        readable.on('end', () => {
          setTimeout(function() { 
            serverConnection.write("finish sending data");
          }, 500);  
          console.log(`finish sending ${receivedData.fileName}`); 
        });
      }
  })
}


    batnode2.createServer(1900, '127.0.0.1', nodeConnectionCallback)
    
    
    // Join:
    
    kadnode2.join(seed)

// const nodeConnectionCallback = (serverConnection) => {
//   serverConnection.on('end', () => {
//     console.log('end')
//   })
//   serverConnection.on('data', (receivedData, error) => {
//   receivedData = JSON.parse(receivedData)
//   // console.log("received data: ", receivedData)


//     if (receivedData.messageType === "RETRIEVE_FILE") {
//       batnode2.readFile(`./hosted/${receivedData.fileName}`, (error, data) => {
//       serverConnection.write(data)
//       })
//     } else if (receivedData.messageType === "STORE_FILE"){
//       let fileName = receivedData.fileName
//       batnode2.kadenceNode.iterativeStore(fileName, [batnode2.kadenceNode.identity.toString(), batnode2.kadenceNode.contact], (err, stored) => {
//         console.log('nodes who stored this value: ', stored)
//         let fileContent = new Buffer(receivedData.fileContent)
//         batnode2.writeFile(`./hosted/${fileName}`, fileContent, (err) => {
//           if (err) {
//             throw err;
//           }
//           serverConnection.write(JSON.stringify({messageType: "SUCCESS"}))
//         })
//       })
//     } else if (receivedData.messageType === "AUDIT_FILE") {
//       batnode2.readFile(`./hosted/${receivedData.fileName}`, (error, data) => {
//         const shardSha1 = fileUtils.sha1HashData(data);
//         console.log("shardSha1: ", shardSha1);
//         serverConnection.write(shardSha1);
//       });
//     }
//   })
// }

// batnode2.createServer(1900, '127.0.0.1', nodeConnectionCallback)


// // Join:

// kadnode2.join(seed)