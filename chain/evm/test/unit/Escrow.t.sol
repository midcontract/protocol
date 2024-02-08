// SPDX-License-Identifier: MIT
pragma solidity =0.8.24;

import {Escrow} from '../../contract/Escrow.sol';
import {Test} from '@forge-std/Test.sol';
import {IERC20} from '@openzeppelin/token/ERC20/IERC20.sol';

abstract contract Base is Test {
  address internal admin = makeAddr('admin');
  address internal alice = makeAddr('alice');
  address internal bob = makeAddr('bob');

  IERC20 internal token = IERC20(makeAddr('token'));
  Escrow internal escrow;

  function setUp() public virtual {
    vm.etch(address(token), new bytes(0x1)); // etch bytecode to avoid address collision problems
    vm.prank(admin);
    escrow = new Escrow();
    vm.prank(admin);
    escrow.addToken(address(token));
  }
}

contract UnitEscrowSetup is Base {
  function test_VaultSet() public {
    assertEq(escrow.vault(), admin);
  }

  function test_TokenSet() public {
    assertEq(escrow.whitelist(address(token)), true);
  }
}
