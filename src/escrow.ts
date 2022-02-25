import { Address, BigInt } from "@graphprotocol/graph-ts/index";
import {
  HolderChanged as HolderChangedEvent, Surrender as SurrenderEvent, TitleCeded as TitleCededEvent,
  TitleEscrowCloneable, TransferTitleEscrowApproval as TransferTitleEscrowApprovalEvent,
} from "../generated/templates/TitleEscrowCloneable/TitleEscrowCloneable";
import { Surrender, TitleEscrowApproval, TitleEscrowHolderTransfer } from "../generated/schema";
import { fetchAccount, fetchTitleEscrow, fetchToken, fetchTokenRegistry, fetchTransaction } from "./utils/fetchers";
import { getTokenEntityId } from "./utils/helpers";

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
