import { Address, BigInt, ethereum, log } from "@graphprotocol/graph-ts/index";
import { Account, TitleEscrow, Token, TokenRegistry, Transaction } from "../../generated/schema";
import { TradeTrustERC721 } from "../../generated/TradeTrustERC721/TradeTrustERC721";
import { TitleEscrowCloneable } from "../../generated/templates/TitleEscrowCloneable/TitleEscrowCloneable";
import { getTokenEntityId, mapTitleEscrowStatusEnum } from "./helpers";
import { TitleEscrowCloneable as TitleEscrowTemplate } from "../../generated/templates";

export function fetchTransaction(event: ethereum.Event): Transaction {
  const id = event.transaction.hash.toHex();
  let transactionEntity = Transaction.load(id);
  if (transactionEntity === null) {
    transactionEntity = new Transaction(event.transaction.hash.toHex());
    transactionEntity.timestamp = event.block.timestamp;
    transactionEntity.blockNumber = event.block.number;
    transactionEntity.save();
  }

  return transactionEntity as Transaction;
}

export function fetchAccount(address: Address): Account {
  const account = new Account(address.toHexString());
  account.save();

  return account as Account;
}

export function fetchTokenRegistry(tokenRegistryAddress: Address): TokenRegistry {
  log.debug("fetchTokenRegistry {} {} {}", [
    tokenRegistryAddress.toHexString(),
    tokenRegistryAddress.toHex(),
    tokenRegistryAddress.toString(),
  ]);

  let registry = TokenRegistry.load(tokenRegistryAddress.toHex());

  if (registry == null) {
    log.debug("fetchTokenRegistry contract is null", []);
    const tokenRegistry = TradeTrustERC721.bind(tokenRegistryAddress);
    registry = new TokenRegistry(tokenRegistryAddress.toHex());
    const tryRegistryName = tokenRegistry.try_name();
    const tryRegistrySymbol = tokenRegistry.try_symbol();
    registry.name = tryRegistryName.reverted ? "" : tryRegistryName.value;
    registry.symbol = tryRegistrySymbol.reverted ? "" : tryRegistrySymbol.value;
    registry.save();
  }

  return registry as TokenRegistry;
}

export function fetchToken(registry: TokenRegistry, tokenId: BigInt): Token {
  // const id = `${registry.id}/${tokenId.toHex()}`;
  const id = getTokenEntityId(registry.id, tokenId);
  let token = Token.load(id);

  const tokenRegistry = TradeTrustERC721.bind(Address.fromString(registry.id));
  const tryOwnerOfToken = tokenRegistry.try_ownerOf(tokenId);
  const tryIsSurrendered = tokenRegistry.try_isSurrendered(tokenId);

  if (token == null) {
    token = new Token(id);
    token.documentId = tokenId;
    token.documentIdHex = tokenId.toHex();
    token.registry = registry.id;
  }

  const isSurrendered = tryIsSurrendered.reverted ? false : tryIsSurrendered.value;

  token.titleEscrow = isSurrendered || tryOwnerOfToken.reverted ? null : tryOwnerOfToken.value.toHex();
  token.surrendered = isSurrendered;

  token.save();

  return token as Token;
}

export function fetchTitleEscrow(titleEscrowAddress: Address): TitleEscrow {
  let titleEscrowEntity = TitleEscrow.load(titleEscrowAddress.toHex());

  if (titleEscrowEntity === null) {
    const titleEscrowContract = TitleEscrowCloneable.bind(titleEscrowAddress);

    const tryRegistryAddress = titleEscrowContract.try_tokenRegistry();
    const tryBeneficiary = titleEscrowContract.try_beneficiary();
    const tryHolder = titleEscrowContract.try_holder();
    const tryTokenId = titleEscrowContract.try__tokenId();

    const registryEntity = fetchTokenRegistry(tryRegistryAddress.reverted ? Address.zero() : tryRegistryAddress.value);
    const beneficiary = fetchAccount(tryBeneficiary.reverted ? Address.zero() : tryBeneficiary.value);
    const holder = fetchAccount(tryHolder.reverted ? Address.zero() : tryHolder.value);

    const tryTitleEscrowStatus = titleEscrowContract.try_status();

    const tokenId = tryTokenId.reverted ? BigInt.zero() : tryTokenId.value;
    const tokenEntityId = `${registryEntity.id}/${tokenId.toHex()}`;
    const status = tryTitleEscrowStatus.reverted
      ? ""
      : mapTitleEscrowStatusEnum(BigInt.fromI32(tryTitleEscrowStatus.value));

    titleEscrowEntity = new TitleEscrow(titleEscrowAddress.toHex());

    titleEscrowEntity.registry = registryEntity.id;
    titleEscrowEntity.token = tokenEntityId;
    titleEscrowEntity.beneficiary = beneficiary.id;
    titleEscrowEntity.holder = holder.id;

    titleEscrowEntity.status = status;

    TitleEscrowTemplate.create(titleEscrowAddress);

    titleEscrowEntity.save();
  }

  return titleEscrowEntity;
}
