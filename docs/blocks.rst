
.. include:: include_announcement.rst

.. _blocks:

==========
快慢/链查询
==========

基于TaiYueChain网络中的混合共识，在网络上存在快链（Fast chain）和慢链（Snail Chain）两种数据结构。其中快链是PBFT委员会执行交易而产生的，产生频率较高，单个区块体积较小；慢链是PoW节点根据快链的区块打包、挖矿产生的，产生频率较低，单个区块体较大。

在web3tai.js中，快链的数据仍然使用例如 ``getBlock()`` ``getBlockNumber()`` 等方法查询，慢链的数据则使用名称中带有 ``snail`` 的类似方法例如 ``getSnail()`` ``getSnailNumber()`` 获取。

快链查询相关
==========

快链的相关查询方法和以太坊区块查询方法一致，但是由于区块结构的差异，返回的区块信息中部分字段可能为空。

getBlock
--------

.. code-block:: javascript

  web3tai.eth.getBlock(blockHashOrBlockNumber [, returnTransactionObjects] [, callback])

查询快链块信息，接收参数和 `web3的方法一致 <https://web3taijs.readthedocs.io/en/1.0/web3-eth.html#getblock>`_，在返回值上和以太坊区块结构有所差异。

新增字段
^^^^^^^

  - ``CommitteeHash`` 32 Bytes - ``String``: 产生该块的委员会的Hash
  - ``signs`` - ``Array``: 产生该快的委员会签名信息
  - ``SnailHash`` 32 Bytes - ``String``: 在当前块中被奖励的慢链Hash，在没有奖励的时候为 ``Address(0)``
  - ``SnailNumber`` - ``Number``: 在当前块中被奖励的慢链高度，在没有奖励的时候为0

移除字段（及其移除理由）
^^^^^^^^^^^^^^^^^^^

  - ``miner``: TaiYueChain网络的块链块不是由矿工产生的，而是委员会生成的
  - ``difficulty``: 块链块上不存在难度值概念
  - ``totalDifficulty``: 块链块上不存在难度值概念
  - ``uncles``: 块链块不会产生分叉

getBlockNumber
--------------

获取当前快链高度，参数和返回值略。

示例
^^^^

.. code-block:: javascript

  web3tai.eth.getBlockNumber()
  .then(console.log);
  > 12332
