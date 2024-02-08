// SPDX-License-Identifier: MIT
pragma solidity =0.8.24;

import {Escrow} from '../contract/Escrow.sol';
import {Script} from '@forge-std/Script.sol';
import {ERC20} from '@openzeppelin/token/ERC20/ERC20.sol';

contract FakeUSDT is ERC20 {
  constructor(uint256 totalSupply) ERC20('FakeUSDT', 'USDT') {
    _mint(_msgSender(), totalSupply);
  }
}

contract Testing is Script {
  function addrByKey(string memory name, uint256 privateKey) internal virtual returns (address addr) {
    addr = vm.addr(privateKey);
    vm.label(addr, name);
  }

  address internal admin = addrByKey('admin', 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80);
  address internal alice = addrByKey('alice', 0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d);
  address internal bob = addrByKey('bob', 0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a);

  function run() public {
    vm.startBroadcast();
    FakeUSDT token = new FakeUSDT(100_000_000_000_000_000_000_000);
    Escrow escrow = new Escrow();
    escrow.addToken(address(token));
    token.transfer(alice, 100_000_000_000_000_000_000_000);
    vm.stopBroadcast();
  }
}
