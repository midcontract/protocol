export const escrow = [
  { inputs: [], name: "Escrow__AlreadyInitialized", type: "error" },
  { inputs: [], name: "Escrow__FeeTooHigh", type: "error" },
  { inputs: [], name: "Escrow__InvalidAmount", type: "error" },
  { inputs: [], name: "Escrow__InvalidContractorDataHash", type: "error" },
  { inputs: [], name: "Escrow__InvalidFeeConfig", type: "error" },
  { inputs: [], name: "Escrow__InvalidStatusForApprove", type: "error" },
  { inputs: [], name: "Escrow__InvalidStatusForSubmit", type: "error" },
  { inputs: [], name: "Escrow__InvalidStatusForWithdraw", type: "error" },
  { inputs: [], name: "Escrow__NotApproved", type: "error" },
  { inputs: [], name: "Escrow__NotEnoughDeposit", type: "error" },
  { inputs: [], name: "Escrow__NotSetFeeManager", type: "error" },
  { inputs: [], name: "Escrow__NotSupportedPaymentToken", type: "error" },
  {
    inputs: [{ internalType: "address", name: "account", type: "address" }],
    name: "Escrow__UnauthorizedAccount",
    type: "error",
  },
  { inputs: [], name: "Escrow__UnauthorizedReceiver", type: "error" },
  { inputs: [], name: "Escrow__ZeroAddressProvided", type: "error" },
  { inputs: [], name: "Escrow__ZeroDepositAmount", type: "error" },
  { inputs: [], name: "NewOwnerIsZeroAddress", type: "error" },
  { inputs: [], name: "Unauthorized", type: "error" },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "uint256", name: "contractId", type: "uint256" },
      { indexed: true, internalType: "uint256", name: "amountApprove", type: "uint256" },
      { indexed: true, internalType: "address", name: "receiver", type: "address" },
    ],
    name: "Approved",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "address", name: "sender", type: "address" },
      { indexed: true, internalType: "uint256", name: "contractId", type: "uint256" },
      { indexed: true, internalType: "address", name: "paymentToken", type: "address" },
      { indexed: false, internalType: "uint256", name: "amount", type: "uint256" },
    ],
    name: "Claimed",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "address", name: "sender", type: "address" },
      { indexed: true, internalType: "uint256", name: "contractId", type: "uint256" },
      { indexed: true, internalType: "address", name: "paymentToken", type: "address" },
      { indexed: false, internalType: "uint256", name: "amount", type: "uint256" },
      { indexed: false, internalType: "uint256", name: "timeLock", type: "uint256" },
      { indexed: false, internalType: "enum Enums.FeeConfig", name: "feeConfig", type: "uint8" },
    ],
    name: "Deposited",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "address", name: "oldOwner", type: "address" },
      { indexed: true, internalType: "address", name: "newOwner", type: "address" },
    ],
    name: "OwnershipTransferred",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "uint256", name: "contractId", type: "uint256" },
      { indexed: true, internalType: "uint256", name: "amountAdditional", type: "uint256" },
    ],
    name: "Refilled",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [{ indexed: false, internalType: "address", name: "registry", type: "address" }],
    name: "RegistryUpdated",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "address", name: "sender", type: "address" },
      { indexed: true, internalType: "uint256", name: "contractId", type: "uint256" },
    ],
    name: "Submitted",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "address", name: "sender", type: "address" },
      { indexed: true, internalType: "uint256", name: "contractId", type: "uint256" },
      { indexed: true, internalType: "address", name: "paymentToken", type: "address" },
      { indexed: false, internalType: "uint256", name: "amount", type: "uint256" },
    ],
    name: "Withdrawn",
    type: "event",
  },
  {
    inputs: [
      { internalType: "uint256", name: "_contractId", type: "uint256" },
      { internalType: "uint256", name: "_amountApprove", type: "uint256" },
      { internalType: "uint256", name: "_amountAdditional", type: "uint256" },
      { internalType: "address", name: "_receiver", type: "address" },
    ],
    name: "approve",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ internalType: "uint256", name: "_contractId", type: "uint256" }],
    name: "claim",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "client",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        components: [
          { internalType: "address", name: "contractor", type: "address" },
          { internalType: "address", name: "paymentToken", type: "address" },
          { internalType: "uint256", name: "amount", type: "uint256" },
          { internalType: "uint256", name: "amountToClaim", type: "uint256" },
          { internalType: "uint256", name: "timeLock", type: "uint256" },
          { internalType: "bytes32", name: "contractorData", type: "bytes32" },
          { internalType: "enum Enums.FeeConfig", name: "feeConfig", type: "uint8" },
          { internalType: "enum Enums.Status", name: "status", type: "uint8" },
        ],
        internalType: "struct IEscrow.Deposit",
        name: "_deposit",
        type: "tuple",
      },
    ],
    name: "deposit",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ internalType: "uint256", name: "contractId", type: "uint256" }],
    name: "deposits",
    outputs: [
      { internalType: "address", name: "contractor", type: "address" },
      { internalType: "address", name: "paymentToken", type: "address" },
      { internalType: "uint256", name: "amount", type: "uint256" },
      { internalType: "uint256", name: "amountToClaim", type: "uint256" },
      { internalType: "uint256", name: "timeLock", type: "uint256" },
      { internalType: "bytes32", name: "contractorData", type: "bytes32" },
      { internalType: "enum Enums.FeeConfig", name: "feeConfig", type: "uint8" },
      { internalType: "enum Enums.Status", name: "status", type: "uint8" },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "bytes", name: "_data", type: "bytes" },
      { internalType: "bytes32", name: "_salt", type: "bytes32" },
    ],
    name: "getContractorDataHash",
    outputs: [{ internalType: "bytes32", name: "", type: "bytes32" }],
    stateMutability: "pure",
    type: "function",
  },
  {
    inputs: [],
    name: "getCurrentContractId",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address", name: "_client", type: "address" },
      { internalType: "address", name: "_owner", type: "address" },
      { internalType: "address", name: "_registry", type: "address" },
    ],
    name: "initialize",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "initialized",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "owner",
    outputs: [{ internalType: "address", name: "result", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "registry",
    outputs: [{ internalType: "contract IRegistry", name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "uint256", name: "_contractId", type: "uint256" },
      { internalType: "bytes", name: "_data", type: "bytes" },
      { internalType: "bytes32", name: "_salt", type: "bytes32" },
    ],
    name: "submit",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ internalType: "address", name: "newOwner", type: "address" }],
    name: "transferOwnership",
    outputs: [],
    stateMutability: "payable",
    type: "function",
  },
  {
    inputs: [{ internalType: "address", name: "_registry", type: "address" }],
    name: "updateRegistry",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ internalType: "uint256", name: "_contractId", type: "uint256" }],
    name: "withdraw",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;
