# Token Registry Subgraph

The subgraph for the OpenAttestation [Token Registry](https://github.com/Open-Attestation/token-registry) contracts.

> ⚠️ Note that this subgraph is currently implemented to work only with the latest [beta](https://github.com/Open-Attestation/token-registry/tree/beta) version of the Token Registry contracts.

This subgraph allows anyone to easily query the network for information about the records from and create opportunities for applications to build on top of your Token Registry contracts.

## Table of Contents
- [Development](#development)
  - [Configuration](#configuration)
  - [Installation](#installation)
- [Deployment](#deployment)
  - [Graph Studio](#graph-studio)
  - [Hosted Service](#hosted-service)
- [Example Queries](#example-queries)

## Development

### Configuration
Configure your Token Registry contract addresses in the `config.json` file.

```json
{
  "network": "rinkeby",
  "dataSources": [
    {
      "address": "0xabc",
      "startBlock": 12345678
    },
    ...
  ]
}
```

* The `network` field can be any one of the many network names supported by the Graph protocol, for eg, `mainnet` for Ethereum mainnet, `matic` for Polygon, `mumbai` for Polygon Mumbai, etc.
* The `address` is the address of your Token Registry contract and `startBlock` is the start block of your contract.
* You can index multiple Token Registry contracts by adding to the `dataSources` array

### Installation
Next, install and generate the subgraph:

```
# Install all dependencies
npm install

# Generate the subgraph
npm run codegen

# You can also build the subgraph:
npm run build
```

After the installation, the `subgraph.yaml` file should be automatically generated for you based on your configurations
in `config.json`. If you have changes in `config.json`, you will need to run the `prepare` script to re-generate it:

```
npm run prepare
```

## Deployment

The deployment can be done either to the Graph Studio or Hosted Service.

### Graph Studio

Authenticate with your Graph deployment key:

```
graph auth
```

Then deploy the subgraph:

```
npm run deploy:studio
```

This deploys the subgraph under the name `token-registry-subgraph`. You can change the name in the `package.json` file.

### Hosted Service

Authenticate with your Graph deployment key:

```
graph auth --product hosted-service
```

Then deploy the subgraph:

```
graph deploy --product hosted-studio GITHUB_USERNAME/token-registry-subgraph
```

Alternatively, you can edit the Github username and subgraph name in `package.json` and run `npm run deploy:hosted` to
deploy the subgraph to the hosted service.

### Example Queries

There are many interesting queries that can be made. Here are some example queries:

* What are all the document IDs and their surrender statuses in my Token Registries?
    ```graphql
    {
      tokenRegistries {
        tokens {
          documentIdHex
          surrendered
        }
      }
    }
    ```
* What are all the documents that the user `0xbabe` is currently a beneficiary?
    ```graphql
    {
      accounts (where: {
        id: "0xbabe"
      }) {
        tokensAsBeneficiary {
          documentIdHex
        }
      }
    }
    ```
* Can I have the complete token transfers (including holder transfers) and approval histories of the document ID `0x0ddba11`? I want to know the beneficiaries and holders that were transferred to and from.
  > 💡 This query is useful (and also a much easier and elegant way) for building the [endorsement chain](https://docs.tradetrust.io/docs/tradetrust-website/endorsement-chain/) of a document or just trying to retrieve the ownership details of any documents.
    ```graphql
    {
      tokens (where: {
        documentIdHex: "0x0ddba11"
      }) {
        transferEvents (orderBy: timestamp) {
          timestamp
          type
          fromTitleEscrow {
            beneficiary {
              id
            }
            holder {
              id
            }
            }
          toTitleEscrow {
            beneficiary {
              id
            }
            holder {
              id
            }
          }
        }
        titleEscrowApprovalEvents (orderBy: timestamp) {
          timestamp
          approvedBeneficiary {
            id
          }
          approvedHolder {
            id
          }
        }
        titleEscrowHolderTransferEvents (orderBy: timestamp) {
          timestamp
          prevHolder {
            id
          }
          holder {
            id
          }
        }
      }
    }
    ```

