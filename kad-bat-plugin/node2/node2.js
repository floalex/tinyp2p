const bunyan = require('bunyan');
const levelup = require('levelup');
const leveldown = require('leveldown');
const encoding = require('encoding-down');
const kad = require('@kadenceproject/kadence');
const BatNode = require('../batnode.js').BatNode;
const kad_bat = require('../kadence_plugin').kad_bat;
const seed = require('../../constants').SEED_NODE;
const fileUtils = require('../../utils/file').fileSystem;
const JSONStream = require('JSONStream');
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
    const batnode2 = new BatNode(kadnode2)
    kadnode2.batNode = batnode2
    
    
    const nodeConnectionCallback = (serverConnection) => {
      
      const stream = JSONStream.parse();
      serverConnection.pipe(stream);
    
      stream.on('end', () => {
        console.log('end')
      })
      
     stream.on('data', (receivedData, error) => {
    
    
        if (receivedData.messageType === "RETRIEVE_FILE") {
          batnode2.readFile(`./hosted/${receivedData.fileName}`, (error, data) => {
           serverConnection.write(data)
          })
        } else if (receivedData.messageType === "STORE_FILE"){
          let fileName = receivedData.fileName
          batnode2.kadenceNode.iterativeStore(fileName, [batnode2.kadenceNode.identity.toString(), batnode2.kadenceNode.contact], (err, stored) => {
        console.log('nodes who stored this value: ', stored)
        let fileContent = new Buffer(receivedData.fileContent)
        batnode2.writeFile(`./hosted/${fileName}`, fileContent, (err) => {
          if (err) {
            throw err;
          }
          serverConnection.write(JSON.stringify({messageType: "SUCCESS"}))
        })
      })
    } else if (receivedData.messageType === "AUDIT_FILE") {
      batnode2.readFile(`./hosted/${receivedData.fileName}`, (error, data) => {
        const shardSha1 = fileUtils.sha1HashData(data);
        serverConnection.write(shardSha1);
      });
    }
  })
}


    batnode2.createServer(1900, '127.0.0.1', nodeConnectionCallback)
    
    
    // Join:
    
    kadnode2.join(seed)

// exports.clinode2 = (function() {
//   const init = () => {
//     kadnode2 = new kad.KademliaNode({
//       transport: new kad.HTTPTransport(),
//       storage: levelup(encoding(leveldown('./dbb'))),
//       contact: { hostname: 'localhost', port: 9000 }
//     })
    
//     // Set up
//     kadnode2.listen(9000)
//     const batnode2 = new BatNode(kadnode2)
//     kadnode2.batNode = batnode2
    
    
//     const nodeConnectionCallback = (serverConnection) => {
//       serverConnection.on('end', () => {
//         console.log('end')
//       })
//       serverConnection.on('data', (receivedData, error) => {
//       receivedData = JSON.parse(receivedData)
//       console.log("received data: ", receivedData)
    
    
//         if (receivedData.messageType === "RETRIEVE_FILE") {
//           batnode2.readFile(`./hosted/${receivedData.fileName}`, (error, data) => {
//           serverConnection.write(data)
//           })
//         } else if (receivedData.messageType === "STORE_FILE"){
//           let fileName = receivedData.fileName
//           let fileContent = new Buffer(receivedData.fileContent)
//           batnode2.writeFile(`./hosted/${fileName}`, fileContent, (err) => {
//             if (err) {
//               throw err;
//             }
//             serverConnection.write(JSON.stringify({messageType: "SUCCESS"}))
//           })
//         }
//       })
//     }
//     batnode2.createServer(1900, '127.0.0.1', nodeConnectionCallback)
    
    
//     // Join:
    
//     kadnode2.join(seed)
//   }   
//   return {
//     init
//   }
// })();