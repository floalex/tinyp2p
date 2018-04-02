const bunyan = require('bunyan');
const levelup = require('levelup');
const leveldown = require('leveldown');
const encoding = require('encoding-down');
const kad = require('@kadenceproject/kadence');
const BatNode = require('../batnode.js').BatNode;
const kad_bat = require('../kadence_plugin').kad_bat;
const seed = require('../../constants').SEED_NODE;
const JSONStream = require('JSONStream');
const stellar_account = require('../kadence_plugin').stellar_account;
const backoff = require('backoff');

// Create a third batnode kadnode pair

const kadnode3 = new kad.KademliaNode({
  transport: new kad.HTTPTransport(),
  storage: levelup(encoding(leveldown('./dbbb'))),
  contact: {hostname: 'localhost', port: 1252}
})

// Set up
kadnode3.plugin(kad_bat);
kadnode3.plugin(stellar_account);
kadnode3.listen(1252)
const batnode3 = new BatNode(kadnode3)
kadnode3.batNode = batnode3
batnode3.createServer(1985, '127.0.0.1')

// Join

kadnode3.join(seed, () => {
  console.log('you have joined the network! Ready to accept commands from the CLI!')
  // batnode3.uploadFile('./personal/example.txt')
  //batnode3.retrieveFile('./manifest/a8fe349f81906570773853d82b52a8b6bedf2a36.batchain')
})

const nodeCLIConnectionCallback = (serverConnection) => {
  const sendAuditDataWhenFinished = (exponentialBackoff) => {
    exponentialBackoff.failAfter(10);
    exponentialBackoff.on('backoff', function(number, delay) {
      console.log(number + ' ' + delay + 'ms');
    });
    exponentialBackoff.on('ready', function() {
      if (!batnode3.audit.ready) {
        exponentialBackoff.backoff();
      } else {
        serverConnection.write(JSON.stringify(batnode3.audit));
        return;
      }
    });
    exponentialBackoff.on('fail', function() {
      console.log('Timeout: failed to complete audit');
    });
    exponentialBackoff.backoff();
  }

  serverConnection.on('data', (data) => {
    let receivedData = JSON.parse(data);
  
    if (receivedData.messageType === "CLI_UPLOAD_FILE") {
      let filePath = receivedData.filePath;

      batnode3.uploadFile(filePath);
      batnode3.kadenceNode;
    } else if (receivedData.messageType === "CLI_DOWNLOAD_FILE") {
      let filePath = receivedData.filePath;
      // console.log("downloadfile: ", filePath);
      batnode3.retrieveFile(filePath);
      batnode3.kadenceNode;
    } else if (receivedData.messageType === "CLI_AUDIT_FILE") {
        let filePath = receivedData.filePath;
        let exponentialBackoff = backoff.exponential({
            randomisationFactor: 0,
            initialDelay: 20,
            maxDelay: 2000
        });

        batnode3.auditFile(filePath);
        // post audit cleanup
        serverConnection.on('close', () => {
          batnode3.audit.ready = false;
          batnode3.audit.data = null;
          batnode3.audit.passed = false;
          batnode3.audit.failed = [];
        });

        // Exponential backoff until file audit finishes
        sendAuditDataWhenFinished(exponentialBackoff);

      } else if (receivedData.messageType === "CLI_PATCH_FILE") {
        const { manifestPath, siblingShardId, failedShaId } = receivedData;

        batnode3.getClosestBatNodeToShard(siblingShardId, (hostBatNodeContact) => {
          const { port, host } = hostBatNodeContact;
          const client = batnode3.connect(port, host, () => {});
          const message = {
            messageType: "RETRIEVE_FILE",
            fileName: siblingShardId,
          };

          client.write(JSON.stringify(message));

          client.on('data', (shardData) => {
            batnode3.patchFile(shardData, manifestPath, failedShaId, hostBatNodeContact)
          })
        })
      }
    })
}

batnode3.createCLIServer(1800, 'localhost', nodeCLIConnectionCallback);


