
.. include:: include_announcement.rst

=====
Web3tai
=====

web3tai类封装了（兼容以太坊网络的）TaiYueChain网络相关的模块。

.. code-block:: javascript

  import Web3tai from 'web3tai';

Web3tai对象的属性和Web3完全一致，如果对这个模块不了解，可以参考web3.js的 `官方文档 <https://web3js.readthedocs.io/en/1.0/>`_。

除了和以太坊兼容的部分，Web3tai针对TaiYueChain网络的特性，拓展了相应的查询、调用接口，你可以通过下面的TrueChain网络特性列表找到对应的API：

:ref:`快/慢链查询 <blocks>`

:ref:`Gas代付 <payment>`
