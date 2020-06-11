
.. include:: include_announcement.rst

.. _start:

======
开始使用
======

关于web3.js库的结构，请查阅web3 1.0官方文档。web3tai.js仅在web3-eth模块下新增了部分方法。

.. _adding-web3tai:

添加web3tai.js
============

.. index:: npm

我们建议使用npm安装web3tai.js到你的项目中。注意：在npm上包的名称为 `taiWeb3js <https://www.npmjs.com/package/taiWeb3js>`_。

- npm: ``npm install taiWeb3js``

或者从我们的git下载源码编译，或直接使用其中的 ``web3tai.min.js`` 文件

- github: `https://github.com/taiyuechain/TaiWeb3js.js <https://github.com/taiyuechain/TaiWeb3js.js>`_

.. _init-web3tai:

初始化Web3tai对象
=============

和初始化web3对象一致，初始化Web3tai对象时需要设置节点链接的提供者（provider）。如同面向以太坊的浏览器插件MetaMask会在全局提供一个 ``ethereumProvider`` 对象一样，如果用户使用我们的浏览器插件 `GreenBelt <https://chrome.google.com/webstore/detail/greenbelt/cgmhechlnfbnfcnomkmcillkgnipocfh?hl=zh-CN>`_。你可以检查全局是否存在可用的 ``web3tai.currentProvider``，否则你需要自己提供一个可用的远端或者本地节点。
与web3.js不同的是，初始化Web3tai对象时还可以传入一个可选的字符串类型变量来指定链接网络的类型。目前的可选值为 ``'tai'`` 或 ``'eth'`` 默认为 ``'tai'``。部分属于TaiYueChain网络特有的方法会在选择网络类型为 ``'eth'`` 时被禁用。

.. code-block:: javascript

  const Web3tai = require('taiWeb3js');

  const web3tai = new Web3tai(web3tai.currentProvider || "http://localhost:8545", 'tai');

  console.log(web3t.currentProvider.type);
  > 'tai'

现在你就已经创建了一个Web3tai对象.

.. note:: 为了和很多会在全局注册web3对象的以太坊工具区分，我们选择并且强烈建议开发者使用后缀 ``tai`` 来区分面向两个不同网络的工具。虽然web3tai本身是完全兼容以太坊网络的接口的，这意味着当你需要开发一个同时在两个链上交互的应用时，你可以仅引入一个web3tai.js。另一方面，为了开发者能够较快的迭代项目至TaiYueChain网络，我们并没有修改web3tai下各模块的名称，以便于代码可以不用做过多改动直接迁移。（我们仍然使用例如 ``web3tai.eth.getBlock()`` 而不是 ``web3tai.tai.getBlock()``）
