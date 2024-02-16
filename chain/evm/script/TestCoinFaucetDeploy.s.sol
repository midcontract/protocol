// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {TestCoinFaucet} from '../test/TestCoinFaucet.sol';
import {Script} from '@forge-std/Script.sol';

contract TestCoinFaucetDeploy is Script {
  function run() public {
    vm.startBroadcast();
    new TestCoinFaucet();
    vm.stopBroadcast();
  }
}
