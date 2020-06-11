/*
 This file is part of web3.js.

 web3.js is free software: you can redistribute it and/or modify
 it under the terms of the GNU Lesser General Public License as published by
 the Free Software Foundation, either version 3 of the License, or
 (at your option) any later version.

 web3.js is distributed in the hope that it will be useful,
 but WITHOUT ANY WARRANTY; without even the implied warranty of
 MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 GNU Lesser General Public License for more details.

 You should have received a copy of the GNU Lesser General Public License
 along with web3.js.  If not, see <http://www.gnu.org/licenses/>.
 */
/**
 * @file accounts.js
 * @author Fabian Vogelsteller <fabian@ethereum.org>
 * @date 2017
 */

"use strict";

var _ = require("underscore");
var core = require('../web3-core');
var Method = require('../web3-core-method');
var Promise = require('any-promise');
var Account = require("eth-lib/lib/account");
var Hash = require("eth-lib/lib/hash");
var RLP = require("eth-lib/lib/rlp");
var Nat = require("eth-lib/lib/nat");
var Bytes = require("eth-lib/lib/bytes");
var cryp = (typeof global === 'undefined') ? require('crypto-browserify') : require('crypto');
var scryptsy = require('scrypt.js');
var uuid = require('uuid');
var utils = require('../web3-utils');
var helpers = require('../web3-core-helpers');

require('babel-polyfill')

var isNot = function(value) {
    return (_.isUndefined(value) || _.isNull(value));
};

var trimLeadingZero = function (hex) {
    while (hex && hex.startsWith('0x0')) {
        hex = '0x' + hex.slice(3);
    }
    return hex;
};

var makeEven = function (hex) {
    if(hex.length % 2 === 1) {
        hex = hex.replace('0x', '0x0');
    }
    return hex;
};

const greenbeltEthSign = async (proxy, hash, chainId) => {
    return new Promise((reslove, reject) => {
        proxy.sendAsync({
            method: 'eth_sign',
            params: [
                proxy.selectedAddress,
                hash
            ]
        }, (error, res) => {
            if (error || res.error) {
                reject(res.error.message)
            } else {
                let signature = res.result
                const basicV = signature.substr(130, 2)
                const v = Nat.toNumber(chainId || '0x1') * 2 + 8 + Number('0x' + basicV)
                signature = signature.substr(0, 130) + v.toString(16)
                reslove(signature)
            }
        })
    })
}


var Accounts = function Accounts() {
    var _this = this;

    // sets _requestmanager
    core.packageInit(this, arguments);

    // remove unecessary core functions
    delete this.BatchRequest;
    delete this.extend;

    var _ethereumCall = [
        new Method({
            name: 'getId',
            call: 'net_version',
            params: 0,
            outputFormatter: utils.hexToNumber
        }),
        new Method({
            name: 'getGasPrice',
            call: () => _this.currentProvider.genCall('gasPrice'),
            params: 0
        }),
        new Method({
            name: 'getTransactionCount',
            call: () => _this.currentProvider.genCall('getTransactionCount'),
            params: 2,
            inputFormatter: [function (address) {
                if (utils.isAddress(address)) {
                    return address;
                } else {
                    throw new Error('Address '+ address +' is not a valid address to get the "transactionCount".');
                }
            }, function () { return 'latest'; }]
        })
    ];
    // attach methods to this._ethereumCall
    this._ethereumCall = {};
    _.each(_ethereumCall, function (method) {
        method.attachToObject(_this._ethereumCall);
        method.setRequestManager(_this._requestManager);
    });


    this.wallet = new Wallet(this);
};

Accounts.prototype._addAccountFunctions = function (account) {
    var _this = this;

    // add sign functions
    account.signTransaction = function signTransaction(tx, callback) {
        return _this.signTransaction(tx, account.privateKey, callback);
    };
    account.signPrePaymentTransaction = function signPrePaymentTransaction(tx, callback) {
        return _this.signPrePaymentTransaction(tx, account.privateKey, callback);
    };
    account.signPaymentTransaction = function signPaymentTransaction(preSignedRawTx, callback) {
        return _this.signPaymentTransaction(preSignedRawTx, account.privateKey, callback);
    };
    account.sign = function sign(data) {
        return _this.sign(data, account.privateKey);
    };

    account.encrypt = function encrypt(password, options) {
        return _this.encrypt(account.privateKey, password, options);
    };


    return account;
};

Accounts.prototype.create = function create(entropy) {
    return this._addAccountFunctions(Account.create(entropy || utils.randomHex(32)));
};

Accounts.prototype.privateKeyToAccount = function privateKeyToAccount(privateKey) {
    return this._addAccountFunctions(Account.fromPrivate(privateKey));
};

Accounts.prototype.signTransaction = async function signTransaction(tx, privateKey, callback) {
    var _this = this,
        error = false,
        result;

    callback = callback || function () {};

    if (!tx) {
        error = new Error('No transaction object given!');

        callback(error);
        return Promise.reject(error);
    }

    async function signed (tx) {
        if (!tx.gas && !tx.gasLimit) {
            error = new Error('"gas" is missing');
        }

        if (tx.nonce  < 0 ||
            tx.gas  < 0 ||
            tx.gasPrice  < 0 ||
            tx.chainId  < 0) {
            error = new Error('Gas, gasPrice, nonce or chainId is lower than 0');
        }

        if (error) {
            callback(error);
            return Promise.reject(error);
        }

        try {
            tx = helpers.formatters.inputCallFormatter(tx);

            var transaction = tx;
            transaction.to = tx.to || '0x';
            transaction.data = tx.data || '0x';
            transaction.value = tx.value || '0x';
            transaction.fee = tx.fee || '0x';
            transaction.payment = '0x';
            transaction.chainId = utils.numberToHex(tx.chainId);

            var rlpEncoded = RLP.encode([
                Bytes.fromNat(transaction.nonce),
                Bytes.fromNat(transaction.gasPrice),
                Bytes.fromNat(transaction.gas),
                transaction.to.toLowerCase(),
                Bytes.fromNat(transaction.value),
                transaction.data,
                Bytes.fromNat(transaction.chainId || "0x1"),
                "0x",
                "0x"]);

            var hash = Hash.keccak256(rlpEncoded);

            let signature = ''
            if (privateKey.isMetaMask) {
                const greenbelt = privateKey
                signature = await greenbeltEthSign(greenbelt, hash, transaction.chainId)
            } else {
                signature = Account.makeSigner(Nat.toNumber(transaction.chainId || "0x1") * 2 + 35)(hash, privateKey)
            }

            var rawTx = RLP.decode(rlpEncoded).slice(0, 6).concat(Account.decodeSignature(signature));

            rawTx[6] = makeEven(trimLeadingZero(rawTx[6]));
            rawTx[7] = makeEven(trimLeadingZero(rawTx[7]));
            rawTx[8] = makeEven(trimLeadingZero(rawTx[8]));

            var rawTransaction = RLP.encode(rawTx);

            var taiRawTransaction = 'can not generate taiRawTransaction while using GreenBelt'
            if (!privateKey.isMetaMask) {
                var taiRlpEncoded = RLP.encode([
                    Bytes.fromNat(transaction.nonce),
                    Bytes.fromNat(transaction.gasPrice),
                    Bytes.fromNat(transaction.gas),
                    transaction.to.toLowerCase(),
                    Bytes.fromNat(transaction.value),
                    transaction.data,
                    transaction.payment.toLowerCase(),
                    Bytes.fromNat(transaction.fee),
                    Bytes.fromNat(transaction.chainId || "0x1"),
                    "0x",
                    "0x"]);
                var taiHash = Hash.keccak256(taiRlpEncoded);
                var taiSignature = Account.makeSigner(Nat.toNumber(transaction.chainId || "0x1") * 2 + 35)(taiHash, privateKey);
                var taiRawTx = RLP.decode(taiRlpEncoded).slice(0, 8).concat(Account.decodeSignature(taiSignature));
                taiRawTx[8] = makeEven(trimLeadingZero(taiRawTx[8]));
                taiRawTx[9] = makeEven(trimLeadingZero(taiRawTx[9]));
                taiRawTx[10] = makeEven(trimLeadingZero(taiRawTx[10]));
                var taiRawTransaction = RLP.encode(taiRawTx);
            }

            var values = RLP.decode(rawTransaction);
            result = {
                messageHash: hash,
                taiHash,
                v: trimLeadingZero(values[6]),
                r: trimLeadingZero(values[7]),
                s: trimLeadingZero(values[8]),
                rawTransaction,
                taiRawTransaction
            };

        } catch(e) {
            callback(e);
            return Promise.reject(e);
        }

        callback(null, result);
        return result;
    }

    // Resolve immediately if nonce, chainId and price are provided
    if (tx.nonce !== undefined && tx.chainId !== undefined && tx.gasPrice !== undefined) {
        return signed(tx)
    }

    let from = ''
    if (privateKey.isMetaMask) {
        const greenbelt = privateKey
        from = greenbelt.selectedAddress
    } else {
        from = _this.privateKeyToAccount(privateKey).address
    }

    // Otherwise, get the missing info from the Ethereum Node
    return Promise.all([
        isNot(tx.chainId) ? _this._ethereumCall.getId() : tx.chainId,
        isNot(tx.gasPrice) ? _this._ethereumCall.getGasPrice() : tx.gasPrice,
        isNot(tx.nonce) ? _this._ethereumCall.getTransactionCount(from) : tx.nonce
    ]).then(function (args) {
        if (isNot(args[0]) || isNot(args[1]) || isNot(args[2])) {
            throw new Error('One of the values "chainId", "gasPrice", or "nonce" couldn\'t be fetched: '+ JSON.stringify(args));
        }
        return signed(_.extend(tx, {chainId: args[0], gasPrice: args[1], nonce: args[2]}));
    });
};

Accounts.prototype.signPrePaymentTransaction = async function signPrePaymentTransaction(tx, privateKey, callback) {
    var _this = this,
        error = false,
        result;

    callback = callback || function () {};

    if (!tx) {
        error = new Error('No transaction object given!');

        callback(error);
        return Promise.reject(error);
    }

    if (!tx.payment) {
        error = new Error('"payment" is missing');
    }

    async function signed (tx) {

        if (!tx.gas && !tx.gasLimit) {
            error = new Error('"gas" is missing');
        }

        if (tx.nonce  < 0 ||
            tx.gas  < 0 ||
            tx.gasPrice  < 0 ||
            tx.chainId  < 0) {
            error = new Error('Gas, gasPrice, nonce or chainId is lower than 0');
        }

        if (error) {
            callback(error);
            return Promise.reject(error);
        }

        try {
            tx = helpers.formatters.inputCallFormatter(tx);

            var transaction = tx;
            transaction.to = tx.to || '0x';
            transaction.data = tx.data || '0x';
            transaction.value = tx.value || '0x';
            transaction.fee = tx.fee || '0x';
            transaction.chainId = utils.numberToHex(tx.chainId);

            var rlpEncoded = RLP.encode([
                Bytes.fromNat(transaction.nonce),
                Bytes.fromNat(transaction.gasPrice),
                Bytes.fromNat(transaction.gas),
                transaction.to.toLowerCase(),
                Bytes.fromNat(transaction.value),
                transaction.data,
                tx.payment.toLowerCase(),
                Bytes.fromNat(transaction.fee),
                Bytes.fromNat(transaction.chainId || "0x1"),
                "0x",
                "0x"]);

            var hash = Hash.keccak256(rlpEncoded);

            let signature = ''
            if (privateKey.isMetaMask) {
                const greenbelt = privateKey
                signature = await greenbeltEthSign(greenbelt, hash, transaction.chainId)
            } else {
                signature = Account.makeSigner(Nat.toNumber(transaction.chainId || "0x1") * 2 + 35)(hash, privateKey)
            }

            var rawTx = RLP.decode(rlpEncoded)
            rawTx.splice(8, 0, ...Account.decodeSignature(signature))

            rawTx[8] = makeEven(trimLeadingZero(rawTx[8]));
            rawTx[9] = makeEven(trimLeadingZero(rawTx[9]));
            rawTx[10] = makeEven(trimLeadingZero(rawTx[10]));

            var rawTransaction = RLP.encode(rawTx);

            var values = RLP.decode(rawTransaction);
            result = {
                messageHash: hash,
                v: trimLeadingZero(values[8]),
                r: trimLeadingZero(values[9]),
                s: trimLeadingZero(values[10]),
                preSignedRawTx: rawTransaction
            };

        } catch(e) {
            callback(e);
            return Promise.reject(e);
        }

        callback(null, result);
        return result;
    }

    // Resolve immediately if nonce, chainId and price are provided
    if (tx.nonce !== undefined && tx.chainId !== undefined && tx.gasPrice !== undefined) {
        return signed(tx)
    }

    // Otherwise, get the missing info from the Ethereum Node
    return Promise.all([
        isNot(tx.chainId) ? _this._ethereumCall.getId() : tx.chainId,
        isNot(tx.gasPrice) ? _this._ethereumCall.getGasPrice() : tx.gasPrice,
        isNot(tx.nonce) ? _this._ethereumCall.getTransactionCount(_this.privateKeyToAccount(privateKey).address) : tx.nonce
    ]).then(function (args) {
        if (isNot(args[0]) || isNot(args[1]) || isNot(args[2])) {
            throw new Error('One of the values "chainId", "gasPrice", or "nonce" couldn\'t be fetched: '+ JSON.stringify(args));
        }
        return signed(_.extend(tx, {chainId: args[0], gasPrice: args[1], nonce: args[2]}));
    });
};

Accounts.prototype.signPaymentTransaction = async function signPaymentTransaction(preSignedRawTx, privateKey, callback) {
    var error = false,
        result;

    callback = callback || function () {};

    if (!preSignedRawTx) {
        error = new Error('No pre-signed raw transaction given!');

        callback(error);
        return Promise.reject(error);
    }

    var values = RLP.decode(preSignedRawTx);

    if (values.length !== 14) {
        error = new Error('invaild pre-signed raw transaction!');

        callback(error);
        return Promise.reject(error);
    }

    try {
        var hash = Hash.keccak256(preSignedRawTx);

        let signature = ''
        if (privateKey.isMetaMask) {
            const greenbelt = privateKey
            signature = await greenbeltEthSign(greenbelt, hash, values[11])
        } else {
            signature = Account.makeSigner(Nat.toNumber(values[11]) * 2 + 35)(hash, privateKey)
        }

        values.splice(11, 3) // remove [chainId, 0x, 0x]
        var rawTx = values.concat(Account.decodeSignature(signature));

        rawTx[11] = makeEven(trimLeadingZero(rawTx[11]));
        rawTx[12] = makeEven(trimLeadingZero(rawTx[12]));
        rawTx[13] = makeEven(trimLeadingZero(rawTx[13]));

        var rawTransaction = RLP.encode(rawTx);

        var newValues = RLP.decode(rawTransaction);
        result = {
            messageHash: hash,
            v: trimLeadingZero(newValues[11]),
            r: trimLeadingZero(newValues[12]),
            s: trimLeadingZero(newValues[13]),
            rawTransaction: rawTransaction
        };
        callback(null, result)
        return Promise.resolve(result)

    } catch(e) {
        callback(e);
        return Promise.reject(e);
    }
};

/* jshint ignore:start */
Accounts.prototype.recoverTransaction = function recoverTransaction(rawTx) {
    var values = RLP.decode(rawTx);
    var signature = Account.encodeSignature(values.slice(6,9));
    var recovery = Bytes.toNumber(values[6]);
    var extraData = recovery < 35 ? [] : [Bytes.fromNumber((recovery - 35) >> 1), "0x", "0x"];
    var signingData = values.slice(0,6).concat(extraData);
    var signingDataHex = RLP.encode(signingData);
    return Account.recover(Hash.keccak256(signingDataHex), signature);
};
/* jshint ignore:end */

Accounts.prototype.hashMessage = function hashMessage(data) {
    var message = utils.isHexStrict(data) ? utils.hexToBytes(data) : data;
    var messageBuffer = Buffer.from(message);
    var preamble = "\x19Ethereum Signed Message:\n" + message.length;
    var preambleBuffer = Buffer.from(preamble);
    var ethMessage = Buffer.concat([preambleBuffer, messageBuffer]);
    return Hash.keccak256s(ethMessage);
};

Accounts.prototype.sign = function sign(data, privateKey) {
    var hash = this.hashMessage(data);
    var signature = Account.sign(hash, privateKey);
    var vrs = Account.decodeSignature(signature);
    return {
        message: data,
        messageHash: hash,
        v: vrs[0],
        r: vrs[1],
        s: vrs[2],
        signature: signature
    };
};

Accounts.prototype.recover = function recover(message, signature, preFixed) {
    var args = [].slice.apply(arguments);


    if (_.isObject(message)) {
        return this.recover(message.messageHash, Account.encodeSignature([message.v, message.r, message.s]), true);
    }

    if (!preFixed) {
        message = this.hashMessage(message);
    }

    if (args.length >= 4) {
        preFixed = args.slice(-1)[0];
        preFixed = _.isBoolean(preFixed) ? !!preFixed : false;

        return this.recover(message, Account.encodeSignature(args.slice(1, 4)), preFixed); // v, r, s
    }
    return Account.recover(message, signature);
};

// Taken from https://github.com/ethereumjs/ethereumjs-wallet
Accounts.prototype.decrypt = function (v3Keystore, password, nonStrict) {
    /* jshint maxcomplexity: 10 */

    if(!_.isString(password)) {
        throw new Error('No password given.');
    }

    var json = (_.isObject(v3Keystore)) ? v3Keystore : JSON.parse(nonStrict ? v3Keystore.toLowerCase() : v3Keystore);

    if (json.version !== 3) {
        throw new Error('Not a valid V3 wallet');
    }

    var derivedKey;
    var kdfparams;
    if (json.crypto.kdf === 'scrypt') {
        kdfparams = json.crypto.kdfparams;

        // FIXME: support progress reporting callback
        derivedKey = scryptsy(new Buffer(password), new Buffer(kdfparams.salt, 'hex'), kdfparams.n, kdfparams.r, kdfparams.p, kdfparams.dklen);
    } else if (json.crypto.kdf === 'pbkdf2') {
        kdfparams = json.crypto.kdfparams;

        if (kdfparams.prf !== 'hmac-sha256') {
            throw new Error('Unsupported parameters to PBKDF2');
        }

        derivedKey = cryp.pbkdf2Sync(new Buffer(password), new Buffer(kdfparams.salt, 'hex'), kdfparams.c, kdfparams.dklen, 'sha256');
    } else {
        throw new Error('Unsupported key derivation scheme');
    }

    var ciphertext = new Buffer(json.crypto.ciphertext, 'hex');

    var mac = utils.sha3(Buffer.concat([ derivedKey.slice(16, 32), ciphertext ])).replace('0x','');
    if (mac !== json.crypto.mac) {
        throw new Error('Key derivation failed - possibly wrong password');
    }

    var decipher = cryp.createDecipheriv(json.crypto.cipher, derivedKey.slice(0, 16), new Buffer(json.crypto.cipherparams.iv, 'hex'));
    var seed = '0x'+ Buffer.concat([ decipher.update(ciphertext), decipher.final() ]).toString('hex');

    return this.privateKeyToAccount(seed);
};

Accounts.prototype.encrypt = function (privateKey, password, options) {
    /* jshint maxcomplexity: 20 */
    var account = this.privateKeyToAccount(privateKey);

    options = options || {};
    var salt = options.salt || cryp.randomBytes(32);
    var iv = options.iv || cryp.randomBytes(16);

    var derivedKey;
    var kdf = options.kdf || 'scrypt';
    var kdfparams = {
        dklen: options.dklen || 32,
        salt: salt.toString('hex')
    };

    if (kdf === 'pbkdf2') {
        kdfparams.c = options.c || 262144;
        kdfparams.prf = 'hmac-sha256';
        derivedKey = cryp.pbkdf2Sync(new Buffer(password), salt, kdfparams.c, kdfparams.dklen, 'sha256');
    } else if (kdf === 'scrypt') {
        // FIXME: support progress reporting callback
        kdfparams.n = options.n || 8192; // 2048 4096 8192 16384
        kdfparams.r = options.r || 8;
        kdfparams.p = options.p || 1;
        derivedKey = scryptsy(new Buffer(password), salt, kdfparams.n, kdfparams.r, kdfparams.p, kdfparams.dklen);
    } else {
        throw new Error('Unsupported kdf');
    }

    var cipher = cryp.createCipheriv(options.cipher || 'aes-128-ctr', derivedKey.slice(0, 16), iv);
    if (!cipher) {
        throw new Error('Unsupported cipher');
    }

    var ciphertext = Buffer.concat([ cipher.update(new Buffer(account.privateKey.replace('0x',''), 'hex')), cipher.final() ]);

    var mac = utils.sha3(Buffer.concat([ derivedKey.slice(16, 32), new Buffer(ciphertext, 'hex') ])).replace('0x','');

    return {
        version: 3,
        id: uuid.v4({ random: options.uuid || cryp.randomBytes(16) }),
        address: account.address.toLowerCase().replace('0x',''),
        crypto: {
            ciphertext: ciphertext.toString('hex'),
            cipherparams: {
                iv: iv.toString('hex')
            },
            cipher: options.cipher || 'aes-128-ctr',
            kdf: kdf,
            kdfparams: kdfparams,
            mac: mac.toString('hex')
        }
    };
};


// Note: this is trying to follow closely the specs on
// http://web3js.readthedocs.io/en/1.0/web3-eth-accounts.html

function Wallet(accounts) {
    this._accounts = accounts;
    this.length = 0;
    this.defaultKeyName = "web3js_wallet";
}

Wallet.prototype._findSafeIndex = function (pointer) {
    pointer = pointer || 0;
    if (_.has(this, pointer)) {
        return this._findSafeIndex(pointer + 1);
    } else {
        return pointer;
    }
};

Wallet.prototype._currentIndexes = function () {
    var keys = Object.keys(this);
    var indexes = keys
        .map(function(key) { return parseInt(key); })
        .filter(function(n) { return (n < 9e20); });

    return indexes;
};

Wallet.prototype.create = function (numberOfAccounts, entropy) {
    for (var i = 0; i < numberOfAccounts; ++i) {
        this.add(this._accounts.create(entropy).privateKey);
    }
    return this;
};

Wallet.prototype.add = function (account) {

    if (_.isString(account)) {
        account = this._accounts.privateKeyToAccount(account);
    }
    if (!this[account.address]) {
        account = this._accounts.privateKeyToAccount(account.privateKey);
        account.index = this._findSafeIndex();

        this[account.index] = account;
        this[account.address] = account;
        this[account.address.toLowerCase()] = account;

        this.length++;

        return account;
    } else {
        return this[account.address];
    }
};

Wallet.prototype.remove = function (addressOrIndex) {
    var account = this[addressOrIndex];

    if (account && account.address) {
        // address
        this[account.address].privateKey = null;
        delete this[account.address];
        // address lowercase
        this[account.address.toLowerCase()].privateKey = null;
        delete this[account.address.toLowerCase()];
        // index
        this[account.index].privateKey = null;
        delete this[account.index];

        this.length--;

        return true;
    } else {
        return false;
    }
};

Wallet.prototype.clear = function () {
    var _this = this;
    var indexes = this._currentIndexes();

    indexes.forEach(function(index) {
        _this.remove(index);
    });

    return this;
};

Wallet.prototype.encrypt = function (password, options) {
    var _this = this;
    var indexes = this._currentIndexes();

    var accounts = indexes.map(function(index) {
        return _this[index].encrypt(password, options);
    });

    return accounts;
};


Wallet.prototype.decrypt = function (encryptedWallet, password) {
    var _this = this;

    encryptedWallet.forEach(function (keystore) {
        var account = _this._accounts.decrypt(keystore, password);

        if (account) {
            _this.add(account);
        } else {
            throw new Error('Couldn\'t decrypt accounts. Password wrong?');
        }
    });

    return this;
};

Wallet.prototype.save = function (password, keyName) {
    localStorage.setItem(keyName || this.defaultKeyName, JSON.stringify(this.encrypt(password)));

    return true;
};

Wallet.prototype.load = function (password, keyName) {
    var keystore = localStorage.getItem(keyName || this.defaultKeyName);

    if (keystore) {
        try {
            keystore = JSON.parse(keystore);
        } catch(e) {

        }
    }

    return this.decrypt(keystore || [], password);
};

if (typeof localStorage === 'undefined') {
    delete Wallet.prototype.save;
    delete Wallet.prototype.load;
}


module.exports = Accounts;
