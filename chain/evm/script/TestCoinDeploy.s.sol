// SPDX-License-Identifier: MIT
pragma solidity =0.8.24;

import {TestCoin} from '../test/TestCoin.sol';
import {Script} from '@forge-std/Script.sol';

contract TestCoinDeploy is Script {
  function run() public {
    vm.startBroadcast();
    new TestCoin();
    vm.stopBroadcast();
  }
}
