export const escrowFactoryAbi = [
  {
    type: "function",
    name: "deployEscrow",
    inputs: [
      {
        name: "_client",
        type: "address",
        internalType: "address",
      },
      {
        name: "_admin",
        type: "address",
        internalType: "address",
      },
      {
        name: "_registry",
        type: "address",
        internalType: "address",
      },
    ],
    outputs: [
      {
        name: "",
        type: "address",
        internalType: "address",
      },
    ],
    stateMutability: "view",
  },
] as const;
