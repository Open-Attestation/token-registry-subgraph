import { Address, BigInt, ethereum } from "@graphprotocol/graph-ts";
import { Account, TitleEscrow, Token, TokenRegistry, Transaction } from "../../generated/schema";
import { TradeTrustERC721 } from "../../generated/TradeTrustERC721/TradeTrustERC721";
import {
  TitleEscrow as TitleEscrowContract,
  TokenReceived as TokenReceivedEvent,
} from "../../generated/templates/TitleEscrow/TitleEscrow";
import { getTokenEntityId } from "./helpers";
import { constants } from "./constants";
import { TitleEscrow as TitleEscrowTemplate } from "../../generated/templates";

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
  let registry = TokenRegistry.load(tokenRegistryAddress.toHex());

  if (registry == null) {
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
  const id = getTokenEntityId(registry.id, tokenId);
  let token = Token.load(id);

  if (token == null) {
    const tokenRegistry = TradeTrustERC721.bind(Address.fromString(registry.id));
    const tryOwnerOfToken = tokenRegistry.try_ownerOf(tokenId);

    const tokenOwner: Address | null = tryOwnerOfToken.reverted ? null : tryOwnerOfToken.value;
    let isSurrendered = false;

    token = new Token(id);
    token.documentId = tokenId.toHex();
    token.documentIdInt = tokenId;
    token.registry = registry.id;

    if (tokenOwner !== null && (
      tokenOwner.equals(Address.fromString(registry.id)) ||
      tokenOwner.equals(constants.DeadAddress)
    )) {
      isSurrendered = true;
    }

    token.titleEscrow = !tokenOwner ? Address.zero().toHex() : tokenOwner.toHex();
    token.surrendered = isSurrendered;
    token.accepted = tokenOwner !== null && tokenOwner.equals(constants.DeadAddress);

    token.save();
  }

  return token as Token;
}

export function fetchTitleEscrow(titleEscrowAddress: Address): TitleEscrow {
  let titleEscrowEntity = TitleEscrow.load(titleEscrowAddress.toHex());

  if (titleEscrowEntity === null) {
    const titleEscrowContract = TitleEscrowContract.bind(titleEscrowAddress);

    const tryRegistryAddress = titleEscrowContract.try_registry();
    const tryBeneficiary = titleEscrowContract.try_beneficiary();
    const tryHolder = titleEscrowContract.try_holder();
    const tryTokenId = titleEscrowContract.try_tokenId();

    const registryEntity = fetchTokenRegistry(tryRegistryAddress.reverted ? Address.zero() : tryRegistryAddress.value);
    const beneficiary = fetchAccount(tryBeneficiary.reverted ? Address.zero() : tryBeneficiary.value);
    const holder = fetchAccount(tryHolder.reverted ? Address.zero() : tryHolder.value);

    const tryTitleEscrowStatus = titleEscrowContract.try_active();

    const tokenId = tryTokenId.reverted ? BigInt.zero() : tryTokenId.value;
    const tokenEntityId = `${registryEntity.id}/${tokenId.toHex()}`;
    const active = tryTitleEscrowStatus.reverted
      ? false
      : tryTitleEscrowStatus.value;

    titleEscrowEntity = new TitleEscrow(titleEscrowAddress.toHex());

    titleEscrowEntity.registry = registryEntity.id;
    titleEscrowEntity.token = tokenEntityId;
    titleEscrowEntity.beneficiary = beneficiary.id;
    titleEscrowEntity.holder = holder.id;

    titleEscrowEntity.active = active;

    TitleEscrowTemplate.create(titleEscrowAddress);

    titleEscrowEntity.save();
  }

  return titleEscrowEntity;
}

export function fetchTokenAndTitleEscrowFromTokenReceivedEvent(event: TokenReceivedEvent): Token {
  const registryEntity = fetchTokenRegistry(event.params.registry);
  const beneficiaryAccEntity = fetchAccount(event.params.beneficiary);
  const holderAccEntity = fetchAccount(event.params.holder);

  const tokenId = event.params.tokenId;
  const tokenEntityId = getTokenEntityId(registryEntity.id, tokenId);

  let titleEscrowEntity = TitleEscrow.load(event.address.toHex());
  if (titleEscrowEntity == null) {
    titleEscrowEntity = new TitleEscrow(event.address.toHex());
    titleEscrowEntity.registry = registryEntity.id;
    titleEscrowEntity.token = tokenEntityId;
    titleEscrowEntity.beneficiary = beneficiaryAccEntity.id;
    titleEscrowEntity.holder = holderAccEntity.id;
    titleEscrowEntity.nominee = null;
    titleEscrowEntity.active = true;

    titleEscrowEntity.save();
  }

  let token = Token.load(tokenEntityId);
  if (token == null) {
    token = new Token(tokenEntityId);
    token.documentId = tokenId.toHex();
    token.documentIdInt = tokenId;
    token.registry = registryEntity.id;
    token.titleEscrow = titleEscrowEntity.id;
    token.surrendered = false;
    token.accepted = false;

    token.save();
  }

  return token;
}
