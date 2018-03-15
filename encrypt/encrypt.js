// Make a private key an environment variable
// Perform above tasks with encrypted files

// `node encrypt.js` to create password and encrypt the file
// `node decrypt.js` to decrypt the file

// crypto is the library in node.js we deal with encryption
const crypto = require('crypto');
const algorithm = 'aes-256-cbc';

const fs = require('fs');
// zip the large file
const zlib = require('zlib');

const path = require('path');
const async = require('async');
const encryptor = require('../encrypt/encrypt.js');

const EncryptHelper = (function(filepath) {
  // Path to temporarily store encrypted version of file to be uploaded
  let tmppath = './' + filepath + '.crypt';

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
  
  const { Transform } = require('stream');

  const reportProgress = new Transform({
    transform(chunk, encoding, callback) {
      process.stdout.write('.');
      callback(null, chunk);
    }
  });

  // write encrypted file
  const w = fs.createWriteStream(tmppath);

  // start pipe, stream to write encrypted
  
  r.pipe(zip).pipe(encrypt).pipe(reportProgress).pipe(w)
   .on('close', () => console.log("The file is fully encrypted"));

});

// EncryptHelper('orgexp.txt', algorithm);

module.exports = EncryptHelper;


// Steps for encrypt:
// 1.Create a password for the encrypted file
// 2.Save the password to a secret path
// 3.read the input file
// 4.zip the file(ideal for the large file)
// 5.encrypt file with crypto.createCipher
// 6.write the encrypted file into another path
// 7.`pipe` steps 3-6


// "use strict";
// var crypto = require("crypto");

// var EncryptionHelper = (function () {

//     function getKeyAndIV(key, callback) {

//         crypto.pseudoRandomBytes(16, function (err, ivBuffer) {
    
//             var keyBuffer  = (key instanceof Buffer) ? key : new Buffer(key) ;
            
//             callback({
//                 iv: ivBuffer,
//                 key: keyBuffer
//             });
//         });
//     }

//     function encryptText(cipher_alg, key, iv, text, encoding) {

//         var cipher = crypto.createCipheriv(cipher_alg, key, iv);

//         encoding = encoding || "binary";

//         var result = cipher.update(text, "utf8", encoding);
//         result += cipher.final(encoding);

//         return result;
//     }

//     function decryptText(cipher_alg, key, iv, text, encoding) {

//         var decipher = crypto.createDecipheriv(cipher_alg, key, iv);

//         encoding = encoding || "binary";

//         var result = decipher.update(text, encoding);
//         result += decipher.final();

//         return result;
//     }

//     return {
//         CIPHERS: {
//           "AES_128": "aes128",          //requires 16 byte key
//           "AES_128_CBC": "aes-128-cbc", //requires 16 byte key
//           "AES_192": "aes192",          //requires 24 byte key
//           "AES_256": "aes256"           //requires 32 byte key
//         },
//         getKeyAndIV: getKeyAndIV,
//         encryptText: encryptText,
//         decryptText: decryptText
//     };
// })();

// module.exports = EncryptionHelper;

// var encryptionHelper = require("./simple-nodejs-iv-encrypt-decrypt.js")
// var story = "this is the story of the brave prince who went off to fight the horrible dragon... he set out on his quest one sunny day";
// var algorithm = encryptionHelper.CIPHERS.AES_256;

// console.log("testing encryption and decryption");
// console.log("text is: " + story);

// encryptionHelper.getKeyAndIV("1234567890abcdefghijklmnopqrstuv", function (data) { //using 32 byte key

//     console.log("got key and iv buffers");

//     var encText = encryptionHelper.encryptText(algorithm, data.key, data.iv, story, "base64");

//     console.log("encrypted text = " + encText);

//     var decText = encryptionHelper.decryptText(algorithm, data.key, data.iv, encText, "base64");

//     console.log("decrypted text = " + decText);

//     assert.equal(decText, story);
// });


// var crypto = require("crypto");
// var path = require("path");
// var fs = require("fs");

// var encryptStringWithRsaPublicKey = function(toEncrypt, relativeOrAbsolutePathToPublicKey) {
//     var absolutePath = path.resolve(relativeOrAbsolutePathToPublicKey);
//     var publicKey = fs.readFileSync(absolutePath, "utf8");
//     var buffer = new Buffer(toEncrypt);
//     var encrypted = crypto.publicEncrypt(publicKey, buffer);
//     return encrypted.toString("base64");
// };

// var decryptStringWithRsaPrivateKey = function(toDecrypt, relativeOrAbsolutePathtoPrivateKey) {
//     var absolutePath = path.resolve(relativeOrAbsolutePathtoPrivateKey);
//     var privateKey = fs.readFileSync(absolutePath, "utf8");
//     var buffer = new Buffer(toDecrypt, "base64");
//     var decrypted = crypto.privateDecrypt(privateKey, buffer);
//     return decrypted.toString("utf8");
// };

// module.exports = {
//     encryptStringWithRsaPublicKey: encryptStringWithRsaPublicKey,
//     decryptStringWithRsaPrivateKey: decryptStringWithRsaPrivateKey
// }

// https://coolaj86.com/articles/asymmetric-public--private-key-encryption-in-node-js/
