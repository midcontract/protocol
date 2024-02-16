import {ERC20} from '@openzeppelin/token/ERC20/ERC20.sol';

contract TestCoin is ERC20 {
  constructor() ERC20('Test Coin for Midcontract', 'USDT') {
    _mint(_msgSender(), 21_000_000_000_000_000_000_000_000);
  }
}
