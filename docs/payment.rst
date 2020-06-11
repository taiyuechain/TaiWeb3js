
.. include:: include_announcement.rst

.. _payment:

==========
Gas代付交易
==========

交易的手续费（gas）代付是TaiYueChain网络的特性。基于这种代付机制，允许在构造交易时使交易的发起方（from）和实际的gas扣费地址不同。这一方案可以使得DAPP等应用的新用户不需要理解繁琐的区块链网络账户、经济系统，而直接采用应用提供者或者第三方提供的代付服务，来完成例如数据上链、登记、投票等轻量级的合约调用。

gas代付交易相比与原始的以太坊交易，在交易的结构、签名过程、发送方式上都略有调整。在代付交易中一般需要两个账户的签名，第一个是交易的实际发送者，对应一般交易的 ``from`` 字段，该账户会先对交易进行签名，生成预代付交易；另一个是交易的实际扣除gas费地址，对应交易新增的 ``payment`` 字段，该账户会对与代付交易签名，生成最终可以直接通过rpc接口发送至节点的 ``TaiRawTransaction``。

.. note:: 在设想的大部分场景中，交易的两次签名会分别在客户端及服务端完成。客户端用户使用自己的新账户生成预代付交易，发送到特定的代付签名服务（在未来，代付服务也将会成为我们链外协议的一部分）。

.. --------------
.. 目录链接
.. --------------

.. :ref:`测试目录1 <web3tai-test1>`

.. :ref:`测试目录2 <web3tai-test2>`

------------------------------------------------------------------------------

.. _web3tai-tx:

交易结构
=======

和以太坊交易结构相比，TaiYueChain网络的交易增加了两个可选字段：

  - ``fee`` - ``String``: 交易额外向矿工支付的费用。在未来这个字段会允许智能合约内部进行查询，以便于一些具有较高价值的ST项目合约可以设置用户手续费的下限。
  - ``payment`` - ``32 Bytes``: 交易的代付账号。如果该字段非空并且签名有效，则仅在扣除gas费用时，会使用代付者账户的余额而不是 ``from`` 账户的余额。

为了便于区分，我们称这种在TaiYueChain网络中特有的交易为TaiTransaction，相应的在web3tai中与之相关的方法或属性名都会带有Tai以作区分。

.. note:: 在逻辑上，节点是可以通过签名来获取 ``payment`` 账户地址的。之所以要显式在交易结构内声明，是为了防止代付方或他人直接拒绝代付签名并将交易直接发送到节点上，而导致交易的发起方预料之外的被扣除了手续费。

.. note:: 由于新增的代付交易需要两次签名，所以没有提供例如 ``web3tai.eth.sendTaiTransaction()`` 的直接签发交易的方法。使用者需要先调用相应方法对交易进行签名，再调用 ``web3tai.eth.sendSignedTaiTransaction()`` 方法发送至节点。

------------------------------------------------------------------------------

.. _web3tai-sign:

交易签名
=======

web3tai.js拓展了 ``web3tai.eth.accounts`` 对象，更新了 ``signTransaction()`` 方法，并且新增了 ``signPrePaymentTransaction()`` 和 ``signPaymentTransaction()`` 方法。
这些方法同样可以直接在 ``Account`` 对象中访问。

.. _signtransaction:

signTransaction
---------------

参数
^^^^

基于web3.js的 `同名方法 <https://web3js.readthedocs.io/en/1.0/web3-eth-accounts.html#signtransaction>`_，在输入参数中新增了可选参数：

  - ``fee`` - ``String``: 交易额外向矿工支付的费用。以wei为单位，默认为0。
  - ``payment`` - ``String``: 交易的代付账号，默认为空。

返回
^^^^

签名成功后的回调函数或 ``Promise`` 传递的对象中增加了新的字段：

  - ``taiHash`` - ``String``: 新增两个交易参数后的消息hash。
  - ``taiRawTransaction`` - ``String``: 新增两个交易参数后签名的RLP编码交易，如果不需要代付签名，则可以直接使用 :ref:`web3tai.eth.sendSignedTaiTransaction() <sendsignedtaitransaction>` 发送。

另外方法本身仍然会直接忽略 ``fee`` 和 ``payment`` 参数进行原始以太坊交易的签名，并生成兼容的签名交易信息。

示例
^^^^

.. code-block:: javascript

  web3tai.eth.accounts.signTransaction({
    to: '0xF0109fC8DF283027b6285cc889F5aA624EaC1F55',
    value: '1000000000',
    gas: '2000000',
    gas: '21000',
    gasPrice: '1000000',
    chainId: '10'
  }, '0x01')
  .then(console.log);
  > {
    messageHash: '0x31995bb8619efeb923c563a352543e1483c8ce6a36d3e63c314a50db119bdfbc',
    taiHash: '0xa15b65bea6ed77c380369c5fb1245bca48ae8ffea5ca433ff0a472b44cfea904',
    s: '0x381b501dc48ee9973e6d0f6afb39b6ec27a2394c923de03277eb88973048ab89',
    r: '0x24d19254a04ee9f79010f7687910cae07b5c6e19233c8cd8259ed93f763903db',
    v: '0x38',
    rawTransaction: '0xf86680830f424082520894f0109fc8df283027b6285cc889f5aa624eac1f55843b9aca008038a024d19254a04ee9f79010f7687910cae07b5c6e19233c8cd8259ed93f763903dba0381b501dc48ee9973e6d0f6afb39b6ec27a2394c923de03277eb88973048ab89',
    taiRawTransaction: '0xf86880830f424082520894f0109fc8df283027b6285cc889f5aa624eac1f55843b9aca0080808038a0602b6369022411dc8592e738d339c7f91f83eeb7448e9d1bc2bf0c27bf54b747a0341d0c7f41ea7673544d9d02284045c3a20241e5e7c196e55c66f53bf5c4d39a'
  }

.. _signprepaymenttransaction:

signPrePaymentTransaction
-------------------------

如同方法名字面所描述，该方法对一个预代付交易进行签名。用该方法生成的预签名交易 **不能用于发送**，而仅用于下一步，由交易的真正扣费账户进一步签名生成 ``TaiRawTransaction`` 并发送。

参数
^^^^

该方法接受的参数和 ``signTransaction`` 完全一致：

  - ``tx`` - ``Object``: 拓展后的TrueTx交易体。
  - ``privateKey`` - ``String``: 用来签名的（交易发起方）私钥。
  - ``callback`` - ``Function``: （可选）回调函数，返回一个错误对象作为第一个参数，签名结果作为第二个参数。

返回
^^^^

该方法返回一个 ``Promise`` 对象，在签名成功时传递以下信息：

  - ``messageHash`` - ``String``: 交易参数的hash。
  - ``r`` - ``String``: 签名的前32字节
  - ``s`` - ``String``: 签名的后32字节
  - ``v`` - ``String``: 签名校验位 + ChainId * 2 + 35
  - ``preSignedRawTx`` - ``String``: 预代付签名的结果，是包含交易和签名，并在末尾补充了 ``chainId`` 等信息后的RLP编码。该交易编码不能直接发送至节点，仅用于在下一步由代付账户进行签名使用。

示例
^^^^

.. code-block:: javascript

  web3tai.eth.accounts.signPrePaymentTransaction({
    nonce: 0,
    gasPrice: '1000000',
    gas: 21000,
    to: '0xF0109fC8DF283027b6285cc889F5aA624EaC1F55',
    value: '1000000000',
    payment: '0x2b5ad5c4795c026514f8317c7a215e218dccd6cf',
    chainId: 10
  }, '0x01')
  .then(console.log);
  > {
    messageHash: '0xd228c0480a74726e74e3a599fcfbc7f629fdf95d2108a3b2615ec99b698b5dd1',
    r: '0xb5b36cf0c1378f0f169ff7f4c05ddb6034bd0e40b9b89eb88091a62e048c0d06',
    s: '0x56e3fb49bbf8517931625bc14183a8013d3a6513b4411a088a297849b772261',
    v: '0x38',
    preSignedRawTx: '0xf87f80830f424082520894f0109fc8df283027b6285cc889f5aa624eac1f55843b9aca0080942b5ad5c4795c026514f8317c7a215e218dccd6cf8038a0b5b36cf0c1378f0f169ff7f4c05ddb6034bd0e40b9b89eb88091a62e048c0d06a0056e3fb49bbf8517931625bc14183a8013d3a6513b4411a088a297849b7722610a8080'
  }

.. _signpaymenttransaction:

signPaymentTransaction
----------------------

该方法对一个签名好的预代付交易进行第二次签名，将交易实际支付gas费的账户信息添加至交易中。和其他签名方法不同的是，该方法签名所使用的所有信息来源于传入的 ``preSignedRawTx`` 字段，而不需要从节点获取（主要是 ``nonce`` 或 ``chianId`` 等信息）。因此实际上该方法是一个同步签名方法。但是为了在结构上和其他签名方法一致，该方法仍然接收一个回调函数并且返回一个 ``Promise`` 对象。

参数
^^^^

  - ``preSignedRawTx`` - ``Object``: 通过上一步 ``signPrePaymentTransaction`` 方法签名的预代付交易。
  - ``privateKey`` - ``String``: 用来签名的实际扣费账户私钥。
  - ``callback`` - ``Function``: （可选）回调函数，返回一个错误对象作为第一个参数，签名结果作为第二个参数。

返回
^^^^

该方法返回一个 ``Promise`` 对象，在签名成功时传递以下信息：

  - ``messageHash`` - ``String``: 交易参数的hash。
  - ``r`` - ``String``: 签名的前32字节
  - ``s`` - ``String``: 签名的后32字节
  - ``v`` - ``String``: 签名校验位 + ChainId * 2 + 35
  - ``rawTransaction`` - ``String``: 最终签名的结果，是包含了交易体、发起方签名、代付方签名的RLP编码。

示例
^^^^

.. code-block:: javascript

  web3tai.eth.accounts.signPaymentTransaction(
    '0xf87f80830f424082520894f0109fc8df283027b6285cc889f5aa624eac1f55843b9aca0080942b5ad5c4795c026514f8317c7a215e218dccd6cf8038a0b5b36cf0c1378f0f169ff7f4c05ddb6034bd0e40b9b89eb88091a62e048c0d06a0056e3fb49bbf8517931625bc14183a8013d3a6513b4411a088a297849b7722610a8080',
    '0x02'
  )
  .then(console.log);
  > {
    messageHash: '0x86de0403beba2ee3d7673deecfe61be053d172cd5b632080bc48d92594dae273',
    r: '0x82cd546986307909da7394c451eb25585146e0c2b2cdb7ae93103a5c60de9dc8',
    s: '0x30d8a50bdb909d6947a5adfea0a6f9ed31c3b6d7ebcf9fe857362b658a0eae7d',
    v: '0x37',
    rawTransaction: '0xf8bf80830f424082520894f0109fc8df283027b6285cc889f5aa624eac1f55843b9aca0080942b5ad5c4795c026514f8317c7a215e218dccd6cf8038a0b5b36cf0c1378f0f169ff7f4c05ddb6034bd0e40b9b89eb88091a62e048c0d06a0056e3fb49bbf8517931625bc14183a8013d3a6513b4411a088a297849b77226137a082cd546986307909da7394c451eb25585146e0c2b2cdb7ae93103a5c60de9dc8a030d8a50bdb909d6947a5adfea0a6f9ed31c3b6d7ebcf9fe857362b658a0eae7d'
  }

------------------------------------------------------------------------------

.. _web3tai-send:

交易发送
=======

.. _sendsignedtaitransaction:

sendSignedTaiTransaction
-------------------------

使用该方法发送签名好的TaiTransaction，调用的方法和返回的数据格式与web3.js的 `sendSignedTransaction <https://web3js.readthedocs.io/en/1.0/web3-eth.html#sendsignedtransaction>`_一致，两者的区别为 ``sendSignedTransaction`` 方法仅能发送原始的以太坊标准的交易，任何带有 ``fee`` 或 ``payment`` 字段的交易必须使用 ``sendSignedTaiTransaction`` 发送。
