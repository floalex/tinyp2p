const bunyan = require('bunyan');
const levelup = require('levelup');
const leveldown = require('leveldown');
const encoding = require('encoding-down');
const kad = require('@kadenceproject/kadence');
const BatNode = require('../batnode.js').BatNode;
const kad_bat = require('../kadence_plugin').kad_bat;
const seed = require('../../constants').SEED_NODE

// Create first node... Will act as a seed node

const kadnode1 = new kad.KademliaNode({
      transport: new kad.HTTPTransport(),
      storage: levelup(encoding(leveldown('./db'))),
      contact: seed[1]
    });
    
    
    kadnode1.identity = seed[0]
    kadnode1.listen(1338)
    //kadnode1.plugin(kad_bat)
    
    const batnode1 = new BatNode(kadnode1) // create batnode
    kadnode1.batNode = batnode1 // tell kadnode who its batnode is
    
     // ask and tell other kad nodes who its batnode is
    
    
     const nodeConnectionCallback = (serverConnection) => {
      serverConnection.on('end', () => {
        console.log('end')
      })
      serverConnection.on('data', (receivedData, error) => {
       receivedData = JSON.parse(receivedData)
       console.log("received data: ", receivedData)
    
    
        if (receivedData.messageType === "RETRIEVE_FILE") {
          batnode1.readFile(`./hosted/${receivedData.fileName}`, (error, data) => {
           serverConnection.write(data)
          })
        } else if (receivedData.messageType === "STORE_FILE"){
          let fileName = receivedData.fileName
      batnode1.kadenceNode.iterativeStore(fileName, [batnode1.kadenceNode.identity.toString(), batnode1.kadenceNode.contact], (err, stored) => {
        console.log('nodes who stored this value: ', stored)
        let fileContent = new Buffer(receivedData.fileContent)
        batnode1.writeFile(`./hosted/${fileName}`, fileContent, (err) => {
          if (err) {
            throw err;
          }
          serverConnection.write(JSON.stringify({messageType: "SUCCESS"}))
        })
      })
    }
  })
}
    
    
    batnode1.createServer(1756, '127.0.0.1', nodeConnectionCallback)
    console.log("connected to: ", kadnode1.batNode.address);
// exports.clinode1 = (function() {
//   const init = () => {
//     const kadnode1 = new kad.KademliaNode({
//       transport: new kad.HTTPTransport(),
//       storage: levelup(encoding(leveldown('./db'))),
//       contact: seed[1]
//     });
    
    
//     kadnode1.identity = seed[0]
//     kadnode1.listen(1338)
//     //kadnode1.plugin(kad_bat)
    
//     const batnode1 = new BatNode(kadnode1) // create batnode
//     kadnode1.batNode = batnode1 // tell kadnode who its batnode is
    
//     // ask and tell other kad nodes who its batnode is
    
    
//     const nodeConnectionCallback = (serverConnection) => {
//       serverConnection.on('end', () => {
//         console.log('end')
//       })
//       serverConnection.on('data', (receivedData, error) => {
//       receivedData = JSON.parse(receivedData)
//       console.log("received data: ", receivedData)
    
    
//         if (receivedData.messageType === "RETRIEVE_FILE") {
//           batnode1.readFile(`./hosted/${receivedData.fileName}`, (error, data) => {
//           serverConnection.write(data)
//           })
//         } else if (receivedData.messageType === "STORE_FILE"){
//           let fileName = receivedData.fileName
//           let fileContent = new Buffer(receivedData.fileContent)
//           batnode1.writeFile(`./hosted/${fileName}`, fileContent, (err) => {
//             if (err) {
//               throw err;
//             }
//             serverConnection.write(JSON.stringify({messageType: "SUCCESS"}))
//           })
//         }
//       })
//     }
    
    
//     batnode1.createServer(1756, '127.0.0.1', nodeConnectionCallback)
//     console.log("connected to: ", kadnode1.batNode.address);
//   };
//   return {
//     init
//   }
// })();