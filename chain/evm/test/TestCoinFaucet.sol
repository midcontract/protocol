// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from '@openzeppelin/access/Ownable.sol';
import {IERC20} from '@openzeppelin/token/ERC20/IERC20.sol';

error TokenTransferError();
error RequiresExactlyEtherOrMore(uint256);

contract TestCoinFaucet is Ownable {
  IERC20 public coin;
  uint256 public rate = 10_000;

  constructor() Ownable(msg.sender) {}

  receive() external payable {
    if (msg.value < 0.01 ether) {
      revert RequiresExactlyEtherOrMore(0.01 ether);
    }
    uint256 value = msg.value * rate;
    if (!coin.transfer(msg.sender, value)) {
      revert TokenTransferError();
    }
  }

  function changeCoin(address value) external onlyOwner {
    coin = IERC20(value);
  }

  function changeRate(uint256 value) external onlyOwner {
    rate = value;
  }

  function withdraw() external onlyOwner {
    payable(owner()).transfer(address(this).balance);
  }

  function withdrawCoin(uint256 value) external onlyOwner {
    if (!coin.transfer(owner(), value)) {
      revert TokenTransferError();
    }
  }
}
