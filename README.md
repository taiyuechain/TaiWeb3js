# Web3tai.js - TaiYueChain Plus ver

This is the TaiYueChain JavaScript API developed based on the Ethereum version.

## Installation

<!-- > NOTICE: You must install lerna via `npm install -g lerna` before install taiWeb3js package. This is a bug that is currently being fixed. (2019-3-27) <Already fixed> -->

install

```
npm install taiWeb3js
```

or update

```
npm update taiWeb3js
```

## Usage

```JavaScript
var Web3tai = require('taiWeb3js');

// connect to TaiYueChain network
var web3tai = new Web3tai('http://localhost:8545', 'tai')
web3tai.eth.getBlockNumber().then(console.log)
// print: block number

console.log(web3tai.currentProvider.type)
// print: "tai"

// switch network type
// incorrect network correspondence can cause methods to fail!
web3tai.setProvider('http://localhost:8545', 'eth')
web3tai.eth.getBlockNumber().then(console.log)
// Returned error: The method eth_blockNumber does not exist/is not available

console.log(web3tai.currentProvider.type)
// print: "eth"
```

## Documentation
The features for the TaiYueChain network can be seen in this [document][docs] (Chinese)
Ethereum-version documentation can be found at [read the docs][eth-docs]. Most methods are called in the same way.

[docs]: https://web3taijs.readthedocs.io/zh/latest/
[eth-docs]: http://web3js.readthedocs.io/en/1.0/
