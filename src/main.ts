import { Address, BigInt } from "@graphprotocol/graph-ts";
import {
  TitleEscrowDeployed as TitleEscrowDeployedEvent,
  Transfer as TransferEvent,
  TokenRestored as TokenRestoredEvent,
} from "../generated/TradeTrustERC721/TradeTrustERC721";
import {
  TitleEscrowCloneable,
} from "../generated/templates/TitleEscrowCloneable/TitleEscrowCloneable";
import {
  Acceptance,
  Restoration,
  TitleEscrow,
  TokenTransfer,
} from "../generated/schema";
import { TitleEscrowCloneable as TitleEscrowTemplate } from "../generated/templates";
import {
  fetchTransaction,
  fetchAccount,
  fetchToken,
  fetchTokenRegistry,
} from "./utils/fetchers";
import { getEventId, getTokenEntityId, mapTitleEscrowStatusEnum } from "./utils/helpers";
import { constants } from "./utils/constants";

export function handleTransfer(event: TransferEvent): void {
  const tokenRegistry = fetchTokenRegistry(event.address);
  const tokenEntity = fetchToken(tokenRegistry, event.params.tokenId);
  const fromTitleEscrow = TitleEscrow.load(event.params.from.toHex());
  const toTitleEscrow = TitleEscrow.load(event.params.to.toHex());

  const transactionEntity = fetchTransaction(event);

  const eventId = `${transactionEntity.id}-${event.logIndex.toString()}`;
  const tokenTransferEvent = new TokenTransfer(`${eventId}/TokenTransfer`);
  tokenTransferEvent.transaction = transactionEntity.id;
  tokenTransferEvent.timestamp = event.block.timestamp;
  tokenTransferEvent.registry = tokenRegistry.id;
  tokenTransferEvent.token = tokenEntity.id;
  tokenTransferEvent.type = "Unknown";

  if (fromTitleEscrow !== null) {
    tokenTransferEvent.fromTitleEscrow = fromTitleEscrow.id;
    tokenTransferEvent.fromBeneficiary = fromTitleEscrow.beneficiary;
    tokenTransferEvent.fromHolder = fromTitleEscrow.holder;
  } else {
    if (event.params.from.equals(Address.zero())) {
      tokenTransferEvent.type = "Mint";
    } else {
      tokenTransferEvent.type = "Restoration";
    }
  }

  if (toTitleEscrow !== null) {
    tokenTransferEvent.toTitleEscrow = toTitleEscrow.id;
    tokenTransferEvent.toBeneficiary = toTitleEscrow.beneficiary;
    tokenTransferEvent.toHolder = toTitleEscrow.holder;
    tokenEntity.beneficiary = toTitleEscrow.beneficiary;
    tokenEntity.holder = toTitleEscrow.holder;
  } else {
    tokenEntity.beneficiary = null;
    tokenEntity.holder = null;
  }

  if (fromTitleEscrow !== null && toTitleEscrow !== null) {
    tokenTransferEvent.type = "TitleEscrowTransfer";
  } else if (fromTitleEscrow !== null && toTitleEscrow == null) {
    tokenTransferEvent.type = "Surrender";
  }

  if (event.params.to.equals(constants.DeadAddress)) {
    tokenTransferEvent.type = "Acceptance";
    const acceptanceEvent = new Acceptance(`${eventId}/Acceptance`);
    acceptanceEvent.transaction = transactionEntity.id;
    acceptanceEvent.timestamp = event.block.timestamp;
    acceptanceEvent.registry = tokenRegistry.id;
    acceptanceEvent.token = tokenEntity.id;
    acceptanceEvent.accepter = fetchAccount(event.transaction.from).id;
    acceptanceEvent.save();
  }

  tokenTransferEvent.save();
  tokenEntity.save();
}

export function handleTitleEscrowDeployed(event: TitleEscrowDeployedEvent): void {
  const titleEscrowContract = TitleEscrowCloneable.bind(event.params.escrowAddress);

  const registry = fetchTokenRegistry(event.address);
  const beneficiary = fetchAccount(event.params.beneficiary);
  const holder = fetchAccount(event.params.holder);

  const tryTokenId = titleEscrowContract.try__tokenId();
  const tryTitleEscrowStatus = titleEscrowContract.try_status();

  const tokenId = tryTokenId.reverted ? BigInt.zero() : tryTokenId.value;
  const tokenEntityId = `${registry.id}/${tokenId.toHex()}`;
  const status = tryTitleEscrowStatus.reverted
    ? ""
    : mapTitleEscrowStatusEnum(BigInt.fromI32(tryTitleEscrowStatus.value));

  const titleEscrowEntity = new TitleEscrow(event.params.escrowAddress.toHex());

  titleEscrowEntity.registry = registry.id;
  titleEscrowEntity.token = tokenEntityId;
  titleEscrowEntity.beneficiary = beneficiary.id;
  titleEscrowEntity.holder = holder.id;

  titleEscrowEntity.status = status;

  TitleEscrowTemplate.create(event.params.escrowAddress);

  titleEscrowEntity.save();
}

export function handleTokenRestored(event: TokenRestoredEvent): void {
  const transactionEntity = fetchTransaction(event);

  const tokenEntityId = getTokenEntityId(event.address.toHex(), event.params.tokenId);

  const eventId = getEventId(event);

  const tokenTransferEntity = TokenTransfer.load(`${eventId}/TokenTransfer`);
  if (tokenTransferEntity !== null) {
    tokenTransferEntity.type = "Restoration";
  }

  const restorationEvent = new Restoration(`${eventId}/Restoration`);
  restorationEvent.transaction = transactionEntity.id;
  restorationEvent.timestamp = event.block.timestamp;
  restorationEvent.registry = event.address.toHex();
  restorationEvent.token = tokenEntityId;
  restorationEvent.titleEscrow = event.params.newOwner.toHex();
  restorationEvent.restorer = fetchAccount(event.transaction.from).id;
  restorationEvent.save();
}
