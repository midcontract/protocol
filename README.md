# `@midcontract/protocol`

Crypto payment protocol with escrow

```mermaid
stateDiagram-v2
    [*] --> PENDING
    PENDING --> SUBMITTED: submit
    SUBMITTED --> PENDING: approve
    SUBMITTED --> DISPUTED: dispute
    PENDING --> DISPUTED: dispute
    DISPUTED --> PENDING: resolve
    PENDING -->  [*]
```

```mermaid
sequenceDiagram
    opt Success
        Alice ->> Escrow: deposit
        Bob ->> Escrow: submit
        Alice ->> Escrow: reject
        Bob ->> Escrow: submit
        Alice ->> Escrow: approve
        Bob ->> Escrow: claim
    end
    opt Withdraw
        Alice ->> Escrow: deposit
        Bob -x Escrow: submit
        Alice ->> Escrow: withdraw
    end
    opt Dispute
        Alice ->> Escrow: deposit
        Bob ->> Escrow: submit
        Alice ->> Escrow: reject
        Bob ->> Escrow: dispute
        alt Bob
            Platform ->> Escrow: approve
            Bob ->> Escrow: claim
        else Alice
            Platform ->> Escrow: reject
            Alice ->> Escrow: withdraw
        end
    end
```

## Install

```shell
npm install --save-prod @midcontract/protocol
```

## Licensing
The primary license for the Midcontract protocol is MIT, see [`LICENSE`](LICENSE)
