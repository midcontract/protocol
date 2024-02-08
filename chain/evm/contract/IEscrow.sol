// SPDX-License-Identifier: MIT
pragma solidity =0.8.24;

/**
 * @title Escrow Contract
 * @author Midcontract
 */
interface IEscrow {
  enum Status {
    PENDING,
    SUBMITTED,
    APPROVED
  }

  event Deposited(
    uint256 indexed depositId,
    address indexed payee,
    address indexed token,
    uint256 amount,
    uint256 timeLock,
    bool allFee
  );

  event Approved(
    uint256 indexed depositId, uint256 amountAllowance, uint256 amountAdditional, address indexed recipient
  );

  event Withdrawn(uint256 indexed depositId, address indexed payee, address indexed token, uint256 amount);

  event Submitted(uint256 indexed depositId, address recipient);

  event DepositClaimed(uint256 indexed depositId, address indexed recipient, address indexed token, uint256 amount);

  event FeeClaimed(uint256 amount);

  error CallOnlyByPayee();
  error CallOnlyByRecipient();
  error DepositAlreadyExists();
  error CannotWithdrawAtThisStage();
  error NotBeSubmitted();
  error NotApproved();
  error NotSupportToken();

  function deposit(
    uint256 depositId,
    address token,
    uint256 amount,
    uint256 timeLock,
    bool fullFee,
    bytes32 recipientData
  ) external;
}
