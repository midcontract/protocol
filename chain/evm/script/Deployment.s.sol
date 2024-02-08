// SPDX-License-Identifier: MIT
pragma solidity =0.8.24;

import {Escrow} from '../contract/Escrow.sol';
import {Script} from '@forge-std/Script.sol';

contract Deployment is Script {
  function run() public {
    vm.startBroadcast();
    new Escrow();
    vm.stopBroadcast();
  }
}
