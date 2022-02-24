import { Address, BigInt, log } from "@graphprotocol/graph-ts";
import {
  TitleEscrowDeployed as TitleEscrowDeployedEvent,
  Transfer as TransferEvent,
  TokenRestored as TokenRestoredEvent,
} from "../generated/TradeTrustERC721/TradeTrustERC721";
import {
  TitleEscrowCloneable,
  Surrender as SurrenderEvent,
  TitleCeded as TitleCededEvent,
  HolderChanged as HolderChangedEvent,
  TransferTitleEscrowApproval as TransferTitleEscrowApprovalEvent,
} from "../generated/templates/TitleEscrowCloneable/TitleEscrowCloneable";
import {
  Acceptance,
  Restoration,
  Surrender,
  TitleEscrow,
  TokenTransfer,
  TitleEscrowApproval,
  TitleEscrowHolderTransfer,
} from "../generated/schema";
import {
  fetchTransaction,
  fetchAccount,
  fetchToken,
  fetchTokenRegistry,
  fetchTitleEscrow,
} from "./utils/fetchers";
import { getTokenEntityId, mapTitleEscrowStatusEnum } from "./utils/helpers";
import { TitleEscrowCloneable as TitleEscrowTemplate } from "../generated/templates";


export function handleTransfer(event: TransferEvent): void {
  const tokenRegistry = fetchTokenRegistry(event.address);
  const token = fetchToken(tokenRegistry, event.params.tokenId);
  const fromTitleEscrow = TitleEscrow.load(event.params.from.toHex());
  const toTitleEscrow = TitleEscrow.load(event.params.to.toHex());

  const transactionEntity = fetchTransaction(event);

  const eventId = `${transactionEntity.id}-${event.logIndex.toString()}`;
  const tokenTransferEvent = new TokenTransfer(`${eventId}/TokenTransfer`);
  tokenTransferEvent.transaction = transactionEntity.id;
  tokenTransferEvent.timestamp = event.block.timestamp;
  tokenTransferEvent.registry = tokenRegistry.id;
  tokenTransferEvent.token = token.id;

  if (fromTitleEscrow !== null) {
    tokenTransferEvent.fromTitleEscrow = fromTitleEscrow.id;
    tokenTransferEvent.fromBeneficiary = fromTitleEscrow.beneficiary;
    tokenTransferEvent.fromHolder = fromTitleEscrow.holder;
  }

  if (toTitleEscrow !== null) {
    tokenTransferEvent.toTitleEscrow = toTitleEscrow.id;
    tokenTransferEvent.toBeneficiary = toTitleEscrow.beneficiary;
    tokenTransferEvent.toHolder = toTitleEscrow.holder;
  }

  tokenTransferEvent.save();

  const deadAddress = Address.fromString("0x000000000000000000000000000000000000dEaD");
  if (event.params.to.equals(deadAddress)) {
    const acceptanceEvent = new Acceptance(`${eventId}/Acceptance`);
    acceptanceEvent.transaction = transactionEntity.id;
    acceptanceEvent.timestamp = event.block.timestamp;
    acceptanceEvent.registry = tokenRegistry.id;
    acceptanceEvent.token = token.id;
    acceptanceEvent.accepter = fetchAccount(event.transaction.from).id;
    acceptanceEvent.save();
  }

  log.debug("tokenTransferEvent event.params.from toTitleEscrow: {} {} {}", [
    event.params.from.toHex(),
    event.params.to.toHex(),
    toTitleEscrow !== null ? toTitleEscrow.id : "null",
  ]);
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

export function handleSurrender(event: SurrenderEvent): void {
  const eventId = `${event.transaction.hash.toHex()}-${event.logIndex.toString()}`;

  const registryEntity = fetchTokenRegistry(event.params.tokenRegistry);
  const tokenEntity = fetchToken(registryEntity, event.params.tokenId);

  const surrenderEvent = new Surrender(`${eventId}/Surrender`);
  surrenderEvent.transaction = fetchTransaction(event).id;
  surrenderEvent.timestamp = event.block.timestamp;
  surrenderEvent.registry = registryEntity.id;
  surrenderEvent.token = tokenEntity.id;
  surrenderEvent.titleEscrow = event.address.toHex();
  surrenderEvent.save();

  tokenEntity.surrendered = true;
  tokenEntity.titleEscrow = null;
  tokenEntity.save();
}

export function handleTransferTitleEscrowApproval(event: TransferTitleEscrowApprovalEvent): void {
  const eventId = `${event.transaction.hash.toHex()}-${event.logIndex.toString()}`;

  const titleEscrowContract = TitleEscrowCloneable.bind(event.address);
  const tryRegistryAddress = titleEscrowContract.try_tokenRegistry();
  const tryTokenId = titleEscrowContract.try__tokenId();

  const approver = fetchAccount(event.transaction.from);
  const approvedBeneficiary = fetchAccount(event.params.newBeneficiary);
  const approvedHolder = fetchAccount(event.params.newHolder);
  const registryAddress = tryRegistryAddress.reverted ? Address.zero().toHex() : tryRegistryAddress.value.toHex();
  const tokenId = tryTokenId.reverted ? BigInt.zero() : tryTokenId.value;
  const tokenEntityId = getTokenEntityId(registryAddress, tokenId);

  const titleEscrowApprovalEvent = new TitleEscrowApproval(`${eventId}/TitleEscrowApproval`);
  titleEscrowApprovalEvent.transaction = fetchTransaction(event).id;
  titleEscrowApprovalEvent.timestamp = event.block.timestamp;
  titleEscrowApprovalEvent.registry = tryRegistryAddress.reverted ? "" : tryRegistryAddress.value.toHex();
  titleEscrowApprovalEvent.token = tokenEntityId;
  titleEscrowApprovalEvent.titleEscrow = event.address.toHex();
  titleEscrowApprovalEvent.approver = approver.id;
  titleEscrowApprovalEvent.approvedBeneficiary = approvedBeneficiary.id;
  titleEscrowApprovalEvent.approvedHolder = approvedHolder.id;

  titleEscrowApprovalEvent.save();
}

export function handleTitleCeded(event: TitleCededEvent): void {
  const titleEscrowEntity = fetchTitleEscrow(event.address);
  titleEscrowEntity.status = "Exited";
  titleEscrowEntity.save();
}

export function handleHolderChanged(event: HolderChangedEvent): void {
  const titleEscrowContract = TitleEscrowCloneable.bind(event.address);

  const titleEscrowEntity = fetchTitleEscrow(event.address);

  const tryRegistryAddress = titleEscrowContract.try_tokenRegistry();

  const entityId = `${event.address.toHex()}-${event.logIndex.toString()}`;
  const registryAddress = tryRegistryAddress.reverted ? Address.zero().toHex() : tryRegistryAddress.value.toHex();
  const prevHolder = event.params.previousHolder.equals(Address.zero())
    ? ""
    : event.params.previousHolder.toHex();

  const titleEscrowHolderTransferEntity = new TitleEscrowHolderTransfer(entityId);
  titleEscrowHolderTransferEntity.transaction = fetchTransaction(event).id;
  titleEscrowHolderTransferEntity.timestamp = event.block.timestamp;
  titleEscrowHolderTransferEntity.registry = registryAddress;
  titleEscrowHolderTransferEntity.token = titleEscrowEntity.token;
  titleEscrowHolderTransferEntity.titleEscrow = event.address.toHex();
  titleEscrowHolderTransferEntity.beneficiary = titleEscrowEntity.beneficiary;
  titleEscrowHolderTransferEntity.holder = event.params.newHolder.toHex();
  titleEscrowHolderTransferEntity.prevHolder = prevHolder;
  titleEscrowHolderTransferEntity.save();
}

export function handleTokenRestored(event: TokenRestoredEvent): void {
  const transactionEntity = fetchTransaction(event);

  const tokenEntityId = getTokenEntityId(event.address.toHex(), event.params.tokenId);

  const eventId = `${transactionEntity.id}-${event.logIndex.toString()}`;

  const restorationEvent = new Restoration(`${eventId}/Restoration`);
  restorationEvent.transaction = transactionEntity.id;
  restorationEvent.timestamp = event.block.timestamp;
  restorationEvent.registry = event.address.toHex();
  restorationEvent.token = tokenEntityId;
  restorationEvent.titleEscrow = event.params.newOwner.toHex();
  restorationEvent.restorer = fetchAccount(event.transaction.from).id;
  restorationEvent.save();
}
