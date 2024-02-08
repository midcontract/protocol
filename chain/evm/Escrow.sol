// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import './interfaces/IERC20.sol';
import './libs/SafeERC20.sol';
import '@openzeppelin/access/AccessControl.sol';
import '@openzeppelin/security/ReentrancyGuard.sol';

error CallOnlyByClient();
error CallOnlyByFreelancer();
error DepositAlreadyExists();
error CannotWithdrawAtThisStage();
error NotApproved();
error NotSupportToken();

contract Escrow is AccessControl, ReentrancyGuard {
  using SafeERC20 for IERC20;

  address private vault;

  uint256 public constant clientFee = 30; // 3%
  uint256 public constant freelancerFee = 50; // 5%
  uint256 public constant FEE_DENOMINATOR = 1000;

  uint256 public tokensCount;
  uint256 private feeAmount;

  mapping(address tokenAddress => bool whitelisted) private whitelistTokens;
  mapping(uint256 id => Deposit depositDetails) private deposits;

  enum Work_Status {
    PENDING_WORK,
    SUBMITED,
    APPROVED
  }

  struct Deposit {
    address client;
    address freelancer;
    address token;
    uint256 amount;
    uint256 amountToClaim;
    Work_Status status;
    bytes configLock;
    bool configFee;
    uint256 freelancerSecretHash;
  }

  event DepositCreated(
    uint256 indexed depositId,
    address indexed client,
    address indexed token,
    uint256 amount,
    bytes configLock,
    bool allFee
  );

  event WithdrawalFunds(uint256 indexed depositId, address indexed client, address indexed token, uint256 amount);

  event SubmitWork(uint256 indexed depositId);

  event ClaimFunds(uint256 indexed depositId, address indexed recipient, address indexed token, uint256 amount);

  event WithdrawalFee(uint256 amount);

  modifier onlyClient(uint256 _depositId) {
    if (deposits[_depositId].client != msg.sender) revert CallOnlyByClient();
    _;
  }

  constructor(address _vault) {
    _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    vault = _vault;
  }

  //---------------------------------- MAIN FUNCTIONS ---------------------------------------------------------------

  function deposit(
    uint256 _depositId,
    address _token,
    uint256 _amount,
    bytes memory _configLock,
    bool _allFee,
    uint256 _freelancerSecretHash
  ) external {
    if (deposits[_depositId].client != address(0)) revert DepositAlreadyExists();
    if (!whitelist(_token)) revert NotSupportToken();

    uint256 toSend;
    uint256 fee;

    if (_allFee) {
      fee = _amount * (clientFee + freelancerFee) / FEE_DENOMINATOR;
      toSend = _amount + fee;
    } else {
      fee = _amount * clientFee / FEE_DENOMINATOR;
      toSend = _amount + fee;
    }
    IERC20(_token).safeTransferFrom(msg.sender, address(this), toSend);

    Deposit storage newDeposit = deposits[_depositId];
    newDeposit.client = msg.sender;
    newDeposit.token = _token;
    newDeposit.amount = _amount;
    newDeposit.status = Work_Status.PENDING_WORK;
    newDeposit.configLock = _configLock;
    newDeposit.configFee = _allFee;
    newDeposit.freelancerSecretHash = _freelancerSecretHash;

    emit DepositCreated(_depositId, msg.sender, _token, _amount, _configLock, _allFee);
  }

  function withdraw(uint256 _depositId) external nonReentrant onlyClient(_depositId) {
    Deposit storage currentDeposit = deposits[_depositId];
    if (currentDeposit.status != Work_Status.PENDING_WORK || currentDeposit.status != Work_Status.SUBMITED) {
      revert CannotWithdrawAtThisStage();
    }

    uint256 fee;
    uint256 toSend;

    if (currentDeposit.configFee) {
      fee = currentDeposit.amount * (clientFee + freelancerFee) / FEE_DENOMINATOR;
      toSend = currentDeposit.amount + fee;
    } else {
      fee = currentDeposit.amount * clientFee / FEE_DENOMINATOR;
      toSend = currentDeposit.amount + fee;
    }

    IERC20(currentDeposit.token).transfer(msg.sender, toSend);

    emit WithdrawalFunds(_depositId, msg.sender, currentDeposit.token, toSend);
  }

  function submit(uint256 _depositId) external {
    Deposit storage currentDeposit = deposits[_depositId];
    require(currentDeposit.status == Work_Status.PENDING_WORK, 'Work status is not on Pending work!');

    if (msg.sender == currentDeposit.client) {
      revert CallOnlyByFreelancer();
    }

    currentDeposit.freelancer = msg.sender;
    currentDeposit.status = Work_Status.SUBMITED;

    emit SubmitWork(_depositId);
  }

  function allowance(
    uint256 _depositId,
    uint256 amountAllowance,
    uint256 amountAdditional
  ) external onlyClient(_depositId) {
    Deposit storage currentDeposit = deposits[_depositId];
    currentDeposit.status = Work_Status.APPROVED;

    if (amountAdditional > 0) {
      uint256 newAmount = amountAllowance += amountAdditional;
      currentDeposit.amountToClaim = newAmount;
    } else {
      currentDeposit.amountToClaim = amountAllowance;
    }
  }

  function claim(uint256 _depositId) external nonReentrant {
    Deposit storage currentDeposit = deposits[_depositId];
    if (currentDeposit.freelancer != msg.sender) revert CallOnlyByFreelancer();
    if (currentDeposit.status != Work_Status.APPROVED) revert NotApproved();

    uint256 fee;
    uint256 toSend;

    if (currentDeposit.configFee) {
      fee = currentDeposit.amount * 80 / 1000;
      feeAmount += fee;
      toSend = currentDeposit.amount;
    } else {
      fee = currentDeposit.amount * 50 / 1000;
      feeAmount += fee;
      toSend = currentDeposit.amount - fee;
    }
    IERC20(currentDeposit.token).transfer(msg.sender, toSend);

    emit ClaimFunds(_depositId, msg.sender, currentDeposit.token, currentDeposit.amountToClaim);
  }

  function addTokenToWhiteList(address _token) external onlyRole(DEFAULT_ADMIN_ROLE) {
    whitelistTokens[_token] = true;
    tokensCount++;
  }

  function removeTokenFromWhiteList(address _token) external onlyRole(DEFAULT_ADMIN_ROLE) {
    whitelistTokens[_token] = false;
    tokensCount--;
  }

  function withdrawFee(address _token) external onlyRole(DEFAULT_ADMIN_ROLE) {
    uint256 toSend = feeAmount;
    IERC20(_token).transfer(vault, toSend);
    feeAmount = 0;

    emit WithdrawalFee(toSend);
  }

  //---------------------------------- SUPPORT FUNCTIONS ------------------------------------------------------------

  function whitelist(address _token) private view returns (bool) {
    return whitelistTokens[_token];
  }
}
