import {MidcontractProtocol} from "@midcontract/protocol"

async function main() {
  console.log("START")
  const list = [
    '0xaf7edb709c0ed9fecb1a1c7217cdc0fba96616c845d70d9c959ca07f290fb8ba',
    '0x16def4b15c48b66a154bb980acebcf391d0f0ec801f07a535ff70be278f10bef',
    '0xb31908b13e86e91a602f3ba1d20f29b2c86563d0dbad167a2f87672fc5791524',
    '0xb085602769ff8d82c59b7e5ee1f753137fe02ddb2ed459e85e0f5b3bc8265776',
  ]
  const mp = MidcontractProtocol.buildByEnvironment('test')
  for (const hash of list) {
    const data = await mp.transactionByHash(hash)
    console.log(await mp.transactionParse(data))
  }
  console.log("END")
}

main().catch(error => {
  if (error instanceof Error) {
    console.log(error.message)
  } else {
    console.log(error)
  }
  process.exit(1)
})
