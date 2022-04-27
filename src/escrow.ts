import { Address } from "@graphprotocol/graph-ts";
import {
  TitleEscrow as TitleEscrowContract,
  TokenReceived as TokenReceivedEvent,
  Surrender as SurrenderEvent,
  Nomination as NominationEvent,
  BeneficiaryTransfer as BeneficiaryTransferEvent,
  HolderTransfer as HolderTransferEvent,
  Shred as ShredEvent
} from "../generated/templates/TitleEscrow/TitleEscrow";
import {
  Surrender,
  Issuance,
  Restoration,
  Nomination,
  NominationRevocation,
  BeneficiaryTransfer,
  HolderTransfer,
  Acceptance
} from "../generated/schema";
import {
  fetchAccount,
  fetchTokenRegistry,
  fetchToken,
  fetchTransaction,
  fetchTitleEscrow,
  fetchTokenAndTitleEscrowFromTokenReceivedEvent
} from "./utils/fetchers";
import { getEventId, createTokenSnapshot, formatAddressValue } from "./utils/helpers";

export function handleTokenReceived(event: TokenReceivedEvent): void {
  const eventId = getEventId(event);
  const registryEntity = fetchTokenRegistry(event.params.registry);
  const tokenEntity = fetchTokenAndTitleEscrowFromTokenReceivedEvent(event);
  const titleEscrowEntity = fetchTitleEscrow(event.address);
  const beneficiaryAccEntity = fetchAccount(event.params.beneficiary);
  const holderAccEntity = fetchAccount(event.params.holder);
  const initiatorAccEntity = fetchAccount(event.transaction.from);

  if (event.params.isMinting) {
    // New Mint
    const issuanceEventEntity = new Issuance(`${eventId}/Issuance`);
    issuanceEventEntity.transaction = fetchTransaction(event).id;
    issuanceEventEntity.timestamp = event.block.timestamp;
    issuanceEventEntity.registry = registryEntity.id;
    issuanceEventEntity.token = tokenEntity.id;
    issuanceEventEntity.beneficiary = beneficiaryAccEntity.id;
    issuanceEventEntity.holder = holderAccEntity.id;
    issuanceEventEntity.titleEscrow = titleEscrowEntity.id;
    issuanceEventEntity.initiator = initiatorAccEntity.id;

    const tokenSnapshotEntity = createTokenSnapshot(event, titleEscrowEntity, tokenEntity, "Issuance");
    issuanceEventEntity.tokenSnapshot = tokenSnapshotEntity.id;

    issuanceEventEntity.save();
  } else {
    // Restoration
    tokenEntity.surrendered = false;
    tokenEntity.save();

    const restorationEventEntity = new Restoration(`${eventId}/Restoration`);
    restorationEventEntity.transaction = fetchTransaction(event).id;
    restorationEventEntity.timestamp = event.block.timestamp;
    restorationEventEntity.registry = registryEntity.id;
    restorationEventEntity.token = tokenEntity.id;
    restorationEventEntity.titleEscrow = titleEscrowEntity.id;
    restorationEventEntity.initiator = initiatorAccEntity.id;

    const tokenSnapshotEntity = createTokenSnapshot(event, titleEscrowEntity, tokenEntity, "Restoration");
    restorationEventEntity.tokenSnapshot = tokenSnapshotEntity.id;

    restorationEventEntity.save();
  }
}

export function handleSurrender(event: SurrenderEvent): void {
  const eventId = getEventId(event);

  const registryEntity = fetchTokenRegistry(event.params.registry);
  const tokenEntity = fetchToken(registryEntity, event.params.tokenId);
  const titleEscrowEntity = fetchTitleEscrow(event.address);
  const initiatorAccEntity = fetchAccount(event.transaction.from);

  tokenEntity.surrendered = true;
  tokenEntity.save();

  const surrenderEventEntity = new Surrender(`${eventId}/Surrender`);
  surrenderEventEntity.transaction = fetchTransaction(event).id;
  surrenderEventEntity.timestamp = event.block.timestamp;
  surrenderEventEntity.registry = registryEntity.id;
  surrenderEventEntity.token = tokenEntity.id;
  surrenderEventEntity.titleEscrow = titleEscrowEntity.id;
  surrenderEventEntity.initiator = initiatorAccEntity.id;

  const tokenSnapshotEntity = createTokenSnapshot(event, titleEscrowEntity, tokenEntity, "Surrender");
  surrenderEventEntity.tokenSnapshot = tokenSnapshotEntity.id;

  surrenderEventEntity.save();
}

export function handleNomination(event: NominationEvent): void {
  const eventId = getEventId(event);

  const registryEntity = fetchTokenRegistry(event.params.registry);
  const tokenEntity = fetchToken(registryEntity, event.params.tokenId);
  const titleEscrowEntity = fetchTitleEscrow(event.address);
  const initiatorAccEntity = fetchAccount(event.transaction.from);
  const nomineeAccEntity = fetchAccount(event.params.nominee);
  const prevNomineeAccEntity = fetchAccount(event.params.prevNominee);

  if (event.params.prevNominee.equals(Address.zero()) && event.params.nominee.equals(Address.zero())) return;

  titleEscrowEntity.nominee = event.params.nominee.equals(Address.zero())
    ? null
    : nomineeAccEntity.id;
  titleEscrowEntity.save();

  if (event.params.nominee.equals(Address.zero())) {
    // Revocation
    const nominationRevocationEventEntity = new NominationRevocation(`${eventId}/NominationRevocation`);
    nominationRevocationEventEntity.transaction = fetchTransaction(event).id;
    nominationRevocationEventEntity.timestamp = event.block.timestamp;
    nominationRevocationEventEntity.registry = registryEntity.id;
    nominationRevocationEventEntity.token = tokenEntity.id;
    nominationRevocationEventEntity.titleEscrow = titleEscrowEntity.id;
    nominationRevocationEventEntity.initiator = initiatorAccEntity.id;
    nominationRevocationEventEntity.nominee = prevNomineeAccEntity.id;

    const tokenSnapshotEntity = createTokenSnapshot(event, titleEscrowEntity, tokenEntity, "NominationRevocation");
    nominationRevocationEventEntity.tokenSnapshot = tokenSnapshotEntity.id;

    nominationRevocationEventEntity.save();
  } else {
    // Nomination
    const nominationEventEntity = new Nomination(`${eventId}/Nomination`);
    nominationEventEntity.transaction = fetchTransaction(event).id;
    nominationEventEntity.timestamp = event.block.timestamp;
    nominationEventEntity.registry = registryEntity.id;
    nominationEventEntity.token = tokenEntity.id;
    nominationEventEntity.titleEscrow = titleEscrowEntity.id;
    nominationEventEntity.nominee = nomineeAccEntity.id;
    nominationEventEntity.prevNominee = formatAddressValue(event.params.prevNominee);
    nominationEventEntity.initiator = initiatorAccEntity.id;

    const tokenSnapshotEntity = createTokenSnapshot(event, titleEscrowEntity, tokenEntity, "Nomination");
    nominationEventEntity.tokenSnapshot = tokenSnapshotEntity.id;

    nominationEventEntity.save();
  }
}

export function handleBeneficiaryTransfer(event: BeneficiaryTransferEvent): void {
  const eventId = getEventId(event);
  const fromBeneficiary = event.params.fromBeneficiary;
  const toBeneficiary = event.params.toBeneficiary;

  if (fromBeneficiary.equals(Address.zero()) || toBeneficiary.equals(Address.zero())) return;

  const registryEntity = fetchTokenRegistry(event.params.registry);
  const tokenEntity = fetchToken(registryEntity, event.params.tokenId);
  const titleEscrowEntity = fetchTitleEscrow(event.address);
  const initiatorAccEntity = fetchAccount(event.transaction.from);
  const fromAccEntity = fetchAccount(fromBeneficiary);
  const toAccEntity = fetchAccount(toBeneficiary);

  const beneficiaryTransferEventEntity = new BeneficiaryTransfer(`${eventId}/BeneficiaryTransfer`);
  beneficiaryTransferEventEntity.transaction = fetchTransaction(event).id;
  beneficiaryTransferEventEntity.timestamp = event.block.timestamp;
  beneficiaryTransferEventEntity.registry = registryEntity.id;
  beneficiaryTransferEventEntity.token = tokenEntity.id;
  beneficiaryTransferEventEntity.titleEscrow = titleEscrowEntity.id;
  beneficiaryTransferEventEntity.initiator = initiatorAccEntity.id;
  beneficiaryTransferEventEntity.from = fromBeneficiary.equals(Address.zero()) ? null : fromAccEntity.id;
  beneficiaryTransferEventEntity.to = toBeneficiary.equals(Address.zero()) ? null : toAccEntity.id;

  titleEscrowEntity.beneficiary = toAccEntity.id;
  titleEscrowEntity.save();

  const tokenSnapshotEntity = createTokenSnapshot(event, titleEscrowEntity, tokenEntity, "BeneficiaryTransfer");
  beneficiaryTransferEventEntity.tokenSnapshot = tokenSnapshotEntity.id;

  beneficiaryTransferEventEntity.save();
}

export function handleHolderTransfer(event: HolderTransferEvent): void {
  const eventId = getEventId(event);
  const fromHolder = event.params.fromHolder;
  const toHolder = event.params.toHolder;

  if (fromHolder.equals(Address.zero()) || toHolder.equals(Address.zero())) return;

  const registryEntity = fetchTokenRegistry(event.params.registry);
  const tokenEntity = fetchToken(registryEntity, event.params.tokenId);
  const titleEscrowEntity = fetchTitleEscrow(event.address);
  const initiatorAccEntity = fetchAccount(event.transaction.from);
  const fromAccEntity = fetchAccount(fromHolder);
  const toAccEntity = fetchAccount(toHolder);

  const holderTransferEventEntity = new HolderTransfer(`${eventId}/HolderTransfer`);
  holderTransferEventEntity.transaction = fetchTransaction(event).id;
  holderTransferEventEntity.timestamp = event.block.timestamp;
  holderTransferEventEntity.registry = registryEntity.id;
  holderTransferEventEntity.token = tokenEntity.id;
  holderTransferEventEntity.titleEscrow = titleEscrowEntity.id;
  holderTransferEventEntity.initiator = initiatorAccEntity.id;
  holderTransferEventEntity.from = fromHolder.equals(Address.zero()) ? null : fromAccEntity.id;
  holderTransferEventEntity.to = toHolder.equals(Address.zero()) ? null : toAccEntity.id;

  titleEscrowEntity.holder = toAccEntity.id;
  titleEscrowEntity.save();

  const tokenSnapshotEntity = createTokenSnapshot(event, titleEscrowEntity, tokenEntity, "HolderTransfer");
  holderTransferEventEntity.tokenSnapshot = tokenSnapshotEntity.id;

  holderTransferEventEntity.save();
}

export function handleShred(event: ShredEvent): void {
  const eventId = getEventId(event);

  const registryEntity = fetchTokenRegistry(event.params.registry);
  const tokenEntity = fetchToken(registryEntity, event.params.tokenId);
  const titleEscrowEntity = fetchTitleEscrow(event.address);
  const initiatorAccEntity = fetchAccount(event.transaction.from);

  const titleEscrowContract = TitleEscrowContract.bind(event.address);

  const acceptanceEventEntity = new Acceptance(`${eventId}/Acceptance`);
  acceptanceEventEntity.transaction = fetchTransaction(event).id;
  acceptanceEventEntity.timestamp = event.block.timestamp;
  acceptanceEventEntity.registry = registryEntity.id;
  acceptanceEventEntity.token = tokenEntity.id;
  acceptanceEventEntity.initiator = initiatorAccEntity.id;

  tokenEntity.surrendered = true;
  tokenEntity.accepted = true;

  const tryBeneficiary = titleEscrowContract.try_beneficiary();
  const tryHolder = titleEscrowContract.try_holder();
  const tryNominee = titleEscrowContract.try_beneficiaryNominee();
  const tryActive = titleEscrowContract.try_active();

  titleEscrowEntity.beneficiary = !tryBeneficiary.reverted ? formatAddressValue(tryBeneficiary.value) : titleEscrowEntity.beneficiary;
  titleEscrowEntity.holder = !tryHolder.reverted ? formatAddressValue(tryHolder.value) : titleEscrowEntity.holder;
  titleEscrowEntity.nominee = !tryNominee.reverted ? formatAddressValue(tryNominee.value) : titleEscrowEntity.nominee;
  titleEscrowEntity.active = !tryActive.reverted ? tryActive.value : titleEscrowEntity.active;

  titleEscrowEntity.save();
  tokenEntity.save();

  const tokenSnapshotEntity = createTokenSnapshot(event, titleEscrowEntity, tokenEntity, "Acceptance");
  acceptanceEventEntity.tokenSnapshot = tokenSnapshotEntity.id;

  acceptanceEventEntity.save();
}
