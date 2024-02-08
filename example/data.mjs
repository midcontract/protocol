import {MidcontractProtocol} from "@midcontract/protocol"

async function main() {
  console.log("START")
  const list = [
    '0x96b639d91eefd281ffbf004a711c72ab61cb1ec39e184c7422cde2ad6d9c1d46',
    '0x5be9a944ad3f149996e8c794467ca86f0a15a05b89c7b5b4813c5488c564a101',
  ]
  const mp = MidcontractProtocol.buildByEnvironment('test')
  for (const id of list) {
    const data = await mp.transactionByHash(id)
    const {input, events} = await mp.transactionParse(data)
    const msg = [input.functionName]
    if (input.functionName === 'deposit') {
      const event = events[0]
      const {symbol, amount} = mp.parseAmount(event.args.token, event.args.amount)
      msg.push(symbol)
      msg.push(amount)
    }
    console.log(msg.join(' '))
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
