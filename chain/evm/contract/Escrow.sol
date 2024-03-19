// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IEscrow} from './IEscrow.sol';

import {AccessControl} from '@openzeppelin/access/AccessControl.sol';
import {IERC20} from '@openzeppelin/token/ERC20/IERC20.sol';
import {SafeERC20} from '@openzeppelin/token/ERC20/utils/SafeERC20.sol';
import {ReentrancyGuard} from '@openzeppelin/utils/ReentrancyGuard.sol';

contract Escrow is IEscrow, AccessControl, ReentrancyGuard {
  using SafeERC20 for IERC20;

  struct Deposit {
    address payee;
    address recipient;
    address token;
    uint256 amount;
    uint256 amountToClaim;
    Status status;
    uint256 timeLock;
    bool configFee;
    bytes32 recipientData;
  }

  uint256 public constant FEE_DENOMINATOR = 1000;

  address public vault;
  uint256 public payeeFee;
  uint256 public recipientFee;
  uint256 public feeAmount;
  mapping(address token => bool whitelisted) public tokenList;
  mapping(uint256 id => Deposit depositDetails) public depositList;

  modifier onlyPayee(uint256 depositId) {
    if (depositList[depositId].payee != msg.sender) revert CallOnlyByPayee();
    _;
  }

  constructor() {
    _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    vault = msg.sender;
    payeeFee = 30; // 3%
    recipientFee = 50; // 5%
  }

  function deposit(
    uint256 depositId,
    address token,
    uint256 amount,
    uint256 timeLock,
    bool fullFee,
    bytes32 recipientData
  ) external {
    if (depositList[depositId].payee != address(0)) revert DepositAlreadyExists();
    if (!whitelist(token)) revert NotSupportToken();

    uint256 toSend = calcDeposit(amount, fullFee);
    IERC20(token).safeTransferFrom(msg.sender, address(this), toSend);

    Deposit storage newDeposit = depositList[depositId];
    newDeposit.payee = msg.sender;
    newDeposit.token = token;
    newDeposit.amount = amount;
    newDeposit.status = Status.PENDING;
    newDeposit.timeLock = timeLock;
    newDeposit.configFee = fullFee;
    newDeposit.recipientData = recipientData;

    emit Deposited(depositId, msg.sender, token, amount, timeLock, fullFee);
  }

  function withdraw(uint256 depositId) external nonReentrant onlyPayee(depositId) {
    Deposit storage current = depositList[depositId];
    if (current.status != Status.PENDING) {
      revert CannotWithdrawAtThisStage();
    }

    uint256 fee;
    uint256 toSend;

    if (current.configFee) {
      fee = current.amount * (payeeFee + recipientFee) / FEE_DENOMINATOR;
      toSend = current.amount + fee;
    } else {
      fee = current.amount * payeeFee / FEE_DENOMINATOR;
      toSend = current.amount + fee;
    }

    IERC20(current.token).transfer(msg.sender, toSend);

    emit Withdrawn(depositId, msg.sender, current.token, toSend);
  }

  function submit(uint256 depositId, string memory data) external {
    Deposit storage current = depositList[depositId];

    if (current.status != Status.PENDING) {
      revert NotBeSubmitted();
    }

    if (current.recipientData != makeDataHash(data)) {
      revert CallOnlyByRecipient();
    }

    current.recipient = msg.sender;
    current.status = Status.SUBMITTED;

    emit Submitted(depositId, msg.sender);
  }

  function refill(uint256 depositId, uint256 amount) private onlyPayee(depositId) {
    Deposit storage current = depositList[depositId];
    if (amount > 0) {
      uint256 toSend = calcDeposit(amount, current.configFee);
      IERC20(current.token).safeTransferFrom(msg.sender, address(this), toSend);
      current.amount += amount;
      emit Refilled(depositId, amount);
    }
  }

  function approve(
    uint256 depositId,
    uint256 valueApprove,
    uint256 valueAdditional,
    address recipient
  ) external onlyPayee(depositId) {
    Deposit storage current = depositList[depositId];
    if (current.recipient == address(0) && recipient != address(0)) {
      current.recipient = recipient;
    }
    refill(depositId, valueAdditional);
    if (valueApprove > 0) {
      current.status = Status.PENDING;
      if (current.amount >= (current.amountToClaim + valueApprove)) {
        current.amountToClaim += valueApprove;
        emit Approved(depositId, valueApprove, recipient);
      } else {
        revert NotEnoughDeposit();
      }
    }
  }

  function calcDeposit(uint256 amount, bool fullFee) public view returns (uint256) {
    if (fullFee) {
      return amount + amount * (recipientFee + payeeFee) / FEE_DENOMINATOR;
    }
    return amount + amount * payeeFee / FEE_DENOMINATOR;
  }

  function calcClaim(uint256 amount, bool fullFee) public view returns (uint256) {
    if (fullFee) {
      return amount;
    }
    return amount - amount * recipientFee / FEE_DENOMINATOR;
  }

  function claim(uint256 depositId) external nonReentrant {
    Deposit storage current = depositList[depositId];
    if (current.recipient != msg.sender) revert CallOnlyByRecipient();
    if (current.amountToClaim == 0) revert NotApproved();

    uint256 toSend = calcClaim(current.amountToClaim, current.configFee);
    IERC20(current.token).transfer(msg.sender, toSend);
    current.amountToClaim = 0;

    emit DepositClaimed(depositId, msg.sender, current.token, toSend);
  }

  function changeVault(address value) external onlyRole(DEFAULT_ADMIN_ROLE) {
    vault = value;
  }

  function changePayeeFee(uint256 value) external onlyRole(DEFAULT_ADMIN_ROLE) {
    payeeFee = value;
  }

  function changeRecipientFee(uint256 value) external onlyRole(DEFAULT_ADMIN_ROLE) {
    recipientFee = value;
  }

  function addToken(address value) external onlyRole(DEFAULT_ADMIN_ROLE) {
    tokenList[value] = true;
  }

  function removeToken(address value) external onlyRole(DEFAULT_ADMIN_ROLE) {
    tokenList[value] = false;
  }

  function whitelist(address value) public view returns (bool) {
    return tokenList[value];
  }

  function makeDataHash(string memory data) public pure returns (bytes32) {
    return keccak256(bytes(data));
  }
}
