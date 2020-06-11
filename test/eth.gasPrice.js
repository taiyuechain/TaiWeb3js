var testMethod = require('./helpers/test.method.js');

var method = 'getGasPrice';
var methodCall = 'tai_gasPrice';

var tests = [{
    result: '0x15f90',
    formattedResult: '90000',
    call: methodCall
}];


testMethod.runTests('eth', method, tests);

