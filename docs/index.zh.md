# TaiyueChain网络Web3说明文档

该JavaScript API基于[以太坊的web3.js](https://github.com/ethereum/web3.js)开发，在保留了web3原有接口的情况下，增加了兼容TaiyueChain主网的设置和新的接口。

## 安装

有三种方法可以安装该API包：

### 使用webpack管理

推荐使用这种方法，可以在开发中灵活的在TaiyueChain和以太坊版本web3.js之间切换，方便版本控制。

在配置文件package.json中增加（或更改原web3.js配置）

``` json
{
  "dependencies": {
    "web3": "github:taiyuechain/TaiWeb3js.js#master"
  }
}
```

之后安装或更新：

``` bash
npm install web3

npm update web3
```

### 直接下载

可以直接下载使用dist目录下的[`web3.min.js`](../dist/web3.min/js)。

``` html
<script src='web3.min.js' />
<script>
  const web3 = new Web3('http://127.0.0.1:8545')
</script>
```

### 下载编译

clone整个仓库并且自己编译，相比于直接下载可以更加灵活控制版本并且进行一定的微调。

``` bash
git clone https://github.com/taiyuechain/TaiWeb3js.git

cd TaiWeb3js

npm i
npm run build
```

使用本地dist路径下的`web3tai.js`或`web3tai.min.js`即可。

## 使用

该API可以同时创建兼容TaiYueChain或以太坊网络的对象。其中部分方法例如`getSnail`只能在连接到TaiYueChain网络时使用。

``` JavaScript
var Web3 = require('web3tai')

// 连接到TaiYueChain网络
var web3 = new Web3tai('http://localhost:8545', 'tai')
web3.eth.getBlockNumber().then(console.log)
// 打印相应的快链高度

console.log(web3.currentProvider.type)
// 打印: "tai"

// 切换网络
// 当网络类型和连接到的节点不匹配时接口无法正常工作
web3.setProvider('http://localhost:8545', 'eth')
web3.eth.getBlockNumber().then(console.log)
// 返回错误: The method eth_blockNumber does not exist/is not available

console.log(web3.currentProvider.type)
// 打印: "eth"
```

## 文档

基本使用方式可以参考以太坊的web3说明文档，可以在[这里](http://web3js.readthedocs.io/en/1.0/)看到。对于开发中常用的接口和拓展的接口会在本文档中单独列出。

## 基本使用

### 初始化

和普通的web3一样，初始化web3对象需要提供相应的`Provider`以连接对等网络节点，包括`HttpProvider`、`WebsocketProvider`、`IpcProvider`。对于TaiYueChain网络可以使用官方提供的节点 https://publicrpc.taiyuechain.com/ ，该`HttpProvider`会始终保持在最新的网络上。

区别于以太坊web3，在设置Provider时需要提供网络的类型，其中`eth`代表以太坊网络，`tai`代表TaiYueChain网络，不同网络的请求名称不通，无法混用。下文中所有接口的展示均默认连接TaiYueChain网络。

> 默认连接网络类型为`tai`，因此也可以不做设置。

#### 输入

1. `Obejct || string` - `provider`：有效的连接节点信息
2. `string` - `type`：[可选]节点类型，可选的输入值为'eth'或者'tai'，其余输入或者不输入都会认为时默认tai网络

#### 示例

``` JavaScript
var Web3 = require('web3')
var web3 = new Web3('http://localhost:8545', 'eth')
// 连接到本地以太坊私有网络

web3.setProvider('https://publicrpc.taiyuechain.com/')
// 连接到TaiYueChain当前主网

console.log(web3.currentProvider.type)
// 输出: "tai"
```

### 导入账户

除了查询接口外，在网络上所有的请求都需要有一个账户，并且从相应的账户中扣取相应的费用。web3提供了`web3.eth.accounts.wallet`对象，可以将账户信息导入到该对象中，则之后所有的请求只要设置了与之账户信息相对应的`from`地址，则可以自动完成请求的签名。

> 除了导入账户外，也可以先构造交易体，再由用户的私钥进行签名，签名后的交易直接使用`web3.eth.sendSignedTransaction`发送即可。这种方法中可以将第二部签名分离出来，交由例如离线钱包、硬件钱包完成，使得整个外层应用不会接触到用户的私钥，更加的安全。  
> Web3本身也提供了相应的签名方法`web3.eth.signTransaction`。

创建账户可以keystore导入或者私钥导入，相应的方法为：`accounts.decrypt(keystoreJsonV3, password)`、`accounts.privateKeyToAccount(privateKey)`。

以上两个方法均会返回账户对象，通过`accounts.wallet.add(account)`方法将其添加至钱包中即可导入该账户。

#### 示例

``` JavaScript
const account = web3.eth.accounts.privateKeyToAccount('0x01')
console.log(account.address)
// "0x7E5F4552091A69125d5DfCb7b8C2659029395Bdf"

web3.eth.accounts.wallet.add(account)
console.log(web3.eth.accounts.wallet)
// {
//  length: 1,
//  0: <account>,
//  0x7E5F4552091A69125d5DfCb7b8C2659029395Bdf: <account>,
//  0x7e5f4552091a69125d5dfcb7b8c2659029395bdf: <account>,
//  ...
//}
```

### 转账

数字资产的转账是区块链网路中最基本的操作，通过构造一笔转账交易，至少包含发送方`from`、接收方`to`、转账金额`value`及其他信息。一般使用的接口为`web3.eth.sendTransaction`

> 合约内的转账或者ERC20代币的转账和网络上本币（TaiYueChain主网里的Tai）的转账时完全不同的。前者的转账依靠调用合约内相应的方法实现。

#### 输入

1. `txObject` - `object`：构造好的要发送的交易信息：

   * `from` - `string`：交易发起方的地址，以0x开头总长为42的十六进制字符串。需要与`accounts.wallet`中的某个账户地址对应，否则无法完成交易的签名。
   * `to` - `string`： 交易接受方的地址，以0x开头总长为42的十六进制字符串。往任何合法地址的转账都是可行的，因此要注意避免由于输入错误将数字资产转移到错误的地址。
   * `value` - `number|string|BN|BigNumber`：转账的数额。
   > 大部分数字资产都有18位小数位，转账数额是以不可拆分的最小数额为单位的非负整数，因此如果需要转账1个True，`value`值应为`'1000000000000000000'`
   * `gas` - `number`：设定执行交易可以使用的gas上限。普通的转账操作gas值固定为21000，因此设置21000即可。
   * `gasPrice` - `number|string|BN|BigNumber`：每单位gas所支付的费用，理论上设定值越高交易越可能被先处理。在网络不繁忙的情况下设置最小值亦可。
   * `nonce` - `number`：[可选]交易的严格递增编号，和交易发起方`from`地址有关。
   > 每个账户对应的相同`nonce`编号的交易只会处理其中一个，编号n的交易一定恰好优先于编号n+1的交易。一般情况下`web3`会自动向网络请求已获得当前应该使用的`nonce`值。但是当连续发送交易时，由于交易执行需要一定时间，连续发放的交易可能会自动生成同样的`nonce`值，进而产生一系列问题，此时应该链式发送交易或手动构造`nonce`值。

2. `callback` - `function`：[可选]回调函数，输入参数为交易执行后返回交易执行的结果或者交易失败时的报错。

#### 返回值

1. `PromiEvent`：异步处理对象，参考[以太坊web3官方文档](https://web3js.readthedocs.io/en/1.0/callbacks-promises-events.html#promievent)。

#### 示例

``` JavaScript
web3.eth.sendTransaction({
  from: '0x7E5F4552091A69125d5DfCb7b8C2659029395Bdf',
  to: '0x2B5AD5c4795c026514f8317c7a215E218DcCD6cF',
  value: '1000000000000000',
  gas: 21000,
  gasPrice: 1
}).then(receipt => {
  ...
})

web3.eth.sendTransaction({
  from: '0x7E5F4552091A69125d5DfCb7b8C2659029395Bdf',
  to: '0x2B5AD5c4795c026514f8317c7a215E218DcCD6cF',
  value: '1000000000000000',
  gas: 21000,
  gasPrice: 1
}).on('transactionHash', hash => {
  ...
}).on('receipt', receipt => {
  ...
}).on('confirmation', (confirmationNumber, receipt) => {
  ...
}).on('error', console.error);
```
