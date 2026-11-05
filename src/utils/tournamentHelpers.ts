import { safeStorage } from '@/services/storage';

const STORAGE_KEY = 'deleted_pending_tournament_registrations';
const CONFIRMED_KEY = 'locally_confirmed_tournament_registrations';

/**
 * Normalizes invoices from any API response format into a clean array of invoices.
 * Handles { success, data: [...] }, { data: { invoices: [...] } }, { invoices: [...] }, etc.
 */
export const normalizeInvoices = (response: any): any[] => {
  if (!response) return [];
  if (Array.isArray(response)) return response;
  if (Array.isArray(response.data)) return response.data;
  if (Array.isArray(response.invoices)) return response.invoices;
  if (Array.isArray(response.data?.invoices)) return response.data.invoices;
  if (Array.isArray(response.data?.data)) return response.data.data;
  if (Array.isArray(response.data?.items)) return response.data.items;
  if (Array.isArray(response.items)) return response.items;
  if (Array.isArray(response.data?.docs)) return response.data.docs;
  if (Array.isArray(response.docs)) return response.docs;
  return [];
};

/**
 * Normalizes a phone number to standard 10-digit digits string.
 */
const cleanDigits = (val: any): string => {
  if (!val) return '';
  return String(val).replace(/\D/g, '').slice(-10);
};

/**
 * Checks whether a given invoice corresponds to a given tournament registration.
 * Cross-references registrationId, tournamentId, orderId, paymentId, tournament name, and phone.
 */
export const invoiceMatchesRegistration = (inv: any, reg: any): boolean => {
  if (!inv || !reg) return false;
  const regId = String(reg._id || reg.id || '').trim();
  const regTournId = String(
    reg.tournamentId?._id || 
    reg.tournamentId || 
    reg.tournament_id || 
    reg.tournament?._id || 
    reg.tournament || 
    ''
  ).trim();
  const regTournName = String(reg.tournament?.name || reg.tournamentName || reg.tournament_name || reg.tournamentId?.name || '').trim().toLowerCase();
  const regOrderId = String(reg.orderId || reg.order_id || reg.order?.id || reg.razorpayOrder?.id || '').trim();
  const regTransId = String(reg.transactionId || reg.transaction_id || reg.paymentTransactionId || reg.razorpay_payment_id || '').trim();
  const regPhone = cleanDigits(reg.phone || reg.mobileNumber || reg.mobile_number || reg.mobile);

  // 1. Direct registration ID match (camelCase and snake_case)
  const invRegId = String(
    inv.registrationId || 
    inv.registration_id || 
    inv.registration?._id || 
    inv.registration || 
    inv.metadata?.registrationId || 
    inv.metadata?.registration_id || 
    inv.bookingId || 
    inv.booking_id || 
    inv.referenceId || 
    inv.reference_id || 
    ''
  ).trim();
  
  if (regId && invRegId && (invRegId === regId || invRegId.includes(regId) || regId.includes(invRegId))) {
    return true;
  }

  // Check in items array of invoice for registrationId
  if (regId && Array.isArray(inv.items)) {
    const itemMatch = inv.items.some((item: any) => {
      const itemRegId = String(
        item.registrationId || 
        item.registration_id || 
        item.registration?._id || 
        item.registration || 
        item.bookingId || 
        item.booking_id || 
        ''
      ).trim();
      return itemRegId && (itemRegId === regId || itemRegId.includes(regId) || regId.includes(itemRegId));
    });
    if (itemMatch) return true;
  }

  // 2. Tournament ID match (camelCase and snake_case)
  const invTournId = String(
    inv.tournamentId || 
    inv.tournament_id || 
    inv.tournament?._id || 
    inv.tournament || 
    inv.metadata?.tournamentId || 
    inv.metadata?.tournament_id || 
    ''
  ).trim();
  
  if (regTournId && invTournId && (invTournId === regTournId || invTournId.includes(regTournId) || regTournId.includes(invTournId))) {
    return true;
  }

  // Check in items array for tournamentId
  if (regTournId && Array.isArray(inv.items)) {
    const itemMatch = inv.items.some((item: any) => {
      const itemTournId = String(item.tournamentId || item.tournament_id || item.tournament?._id || item.tournament || '').trim();
      return itemTournId && (itemTournId === regTournId || itemTournId.includes(regTournId) || regTournId.includes(itemTournId));
    });
    if (itemMatch) return true;
  }

  // 3. Razorpay Order ID or Transaction ID match
  const invOrderId = String(inv.orderId || inv.order_id || inv.paymentOrderId || inv.razorpayOrderId || inv.metadata?.orderId || '').trim();
  if (regOrderId && invOrderId && regOrderId === invOrderId) {
    return true;
  }

  const invTransId = String(inv.paymentId || inv.payment_id || inv.transactionId || inv.transaction_id || inv.razorpayPaymentId || inv.metadata?.transactionId || '').trim();
  if (regTransId && invTransId && regTransId === invTransId) {
    return true;
  }

  // 4. Tournament Name match (if tournament name is meaningful, e.g. >= 3 characters)
  if (regTournName && regTournName.length >= 3) {
    const invTitle = String(
      inv.title || 
      inv.tournamentName || 
      inv.tournament_name || 
      inv.description || 
      inv.name || 
      inv.metadata?.tournamentName || 
      inv.metadata?.tournament_name || 
      ''
    ).toLowerCase();
    if (invTitle.includes(regTournName) || regTournName.includes(invTitle)) {
      return true;
    }
  }

  // 5. Phone match (if 10-digit phone matches and invoice is for a tournament)
  const invPhone = cleanDigits(inv.phone || inv.mobileNumber || inv.mobile_number || inv.customerPhone || inv.user?.phone);
  if (regPhone && invPhone && regPhone === invPhone && isTournamentInvoice(inv)) {
    // If phone matches and both reference the same sport/category or neither is coaching
    const regCategory = String(reg.categoryName || reg.category || '').toLowerCase();
    const invDesc = String(inv.title || inv.description || '').toLowerCase();
    if (!regCategory || !invDesc || invDesc.includes(regCategory) || regCategory.includes(invDesc)) {
      return true;
    }
  }

  return false;
};

/**
 * Checks whether an invoice is related to a tournament or registration.
 */
export const isTournamentInvoice = (inv: any): boolean => {
  if (!inv) return false;
  const type = String(inv.type || '').toLowerCase();

  // Explicit tournament type
  if (type.includes('tournament') || type.includes('novare') || type.includes('competition') || type.includes('event')) {
    return true;
  }

  // Has tournament ID or registration ID
  if (
    inv.tournamentId || 
    inv.tournament_id || 
    inv.tournament || 
    inv.registrationId || 
    inv.registration_id || 
    inv.registration || 
    inv.metadata?.tournamentId || 
    inv.metadata?.tournament_id || 
    inv.metadata?.registrationId || 
    inv.metadata?.registration_id
  ) {
    return true;
  }

  // Title or description keywords
  const title = String(inv.title || inv.description || inv.name || '').toLowerCase();
  if (
    title.includes('tournament') || 
    title.includes('championship') || 
    title.includes('cup') || 
    title.includes('league') ||
    title.includes('trophy') ||
    title.includes('open') ||
    title.includes('slam') ||
    title.includes('entry')
  ) {
    return true;
  }

  // If not explicitly a coaching private session, treat as tournament/registration invoice
  if (!type.includes('coaching') && !title.includes('coaching session') && !title.includes('coach booking')) {
    return true;
  }

  return false;
};

/**
 * Determines whether a registration object is confirmed / paid.
 */
export const isRegistrationConfirmed = (
  reg: any, 
  locallyConfirmedIds: string[] = [], 
  invoices: any[] = []
): boolean => {
  if (!reg) return false;
  const rid = String(reg._id || reg.id || '').trim();
  const tId = String(reg.tournamentId?._id || reg.tournamentId || reg.tournament?._id || reg.tournament || '').trim();

  // If an invoice exists matching this registration, it is PROVEN PAID AND CONFIRMED
  const hasInvoice = invoices.some(inv => invoiceMatchesRegistration(inv, reg));
  if (hasInvoice) return true;

  // Locally confirmed during current session / checkout
  if ((rid && locallyConfirmedIds.includes(rid)) || (tId && locallyConfirmedIds.includes(tId))) {
    return true;
  }

  // Explicitly marked paid / confirmed in DB
  const paymentStatus = String(reg?.paymentStatus || '').toUpperCase();
  const registrationStatus = String(reg?.registrationStatus || reg?.status || '').toUpperCase();

  // If DB says paid
  const isPaid = 
    paymentStatus === 'PAID' || 
    paymentStatus === 'COMPLETED' || 
    paymentStatus === 'VERIFIED' || 
    paymentStatus === 'SUCCESS';
  if (isPaid) return true;

  // If DB says confirmed and not explicitly refunded
  const isConfirmed = 
    registrationStatus === 'CONFIRMED' || 
    registrationStatus === 'VERIFIED' || 
    registrationStatus === 'REGISTERED' || 
    registrationStatus === 'SUCCESS' || 
    registrationStatus === 'COMPLETED';
  if (isConfirmed && paymentStatus !== 'REFUNDED') return true;

  // Has attached invoice ID or number
  if (reg?.invoiceId || reg?.invoice || reg?.invoiceNumber) {
    return true;
  }

  return false;
};

export interface ProcessedTournamentsResult {
  confirmedRegistrations: any[];
  pendingRegistrations: any[];
  allInvoices: any[];
  totalPaidAmount: number;
}

/**
 * Unified processor that merges raw registrations and invoices into accurate confirmed & pending lists.
 * Synthesizes confirmed entries from invoices so no paid tournament is ever omitted.
 */
export const processTournamentRegistrations = ({
  rawRegistrations,
  invoicesResponse,
  locallyConfirmedIds = [],
  deletedIds = [],
}: {
  rawRegistrations: any;
  invoicesResponse: any;
  locallyConfirmedIds: string[];
  deletedIds: string[];
}): ProcessedTournamentsResult => {
  const allInvoices = normalizeInvoices(invoicesResponse);
  const rawList = Array.isArray(rawRegistrations) 
    ? rawRegistrations 
    : (rawRegistrations?.registrations || rawRegistrations?.data || []);

  const matchedInvoiceIds = new Set<string>();
  const confirmedTournamentIds = new Set<string>();
  const confirmedTournamentNames = new Set<string>();

  const confirmedRegistrations: any[] = [];
  const candidatePendingRegistrations: any[] = [];

  // 1. Process all raw registration records from DB
  rawList.forEach((regItem: any) => {
    if (!regItem) return;
    const reg = { ...regItem };
    const rid = String(reg._id || reg.id || '').trim();
    const tId = String(reg.tournamentId?._id || reg.tournamentId || reg.tournament?._id || reg.tournament || '').trim();
    const tName = String(reg.tournament?.name || reg.tournamentName || reg.tournamentId?.name || '').trim();

    // Check if any invoice matches this registration
    const matchingInvoice = allInvoices.find(inv => invoiceMatchesRegistration(inv, reg));
    
    if (matchingInvoice) {
      const invId = matchingInvoice._id || matchingInvoice.id;
      if (invId) matchedInvoiceIds.add(invId);

      // Invoice is verified proof of payment!
      reg.paymentStatus = 'PAID';
      reg.registrationStatus = 'CONFIRMED';
      reg.status = 'CONFIRMED';
      reg.isPaid = true;
      reg.invoiceId = invId;
      reg.invoiceNumber = matchingInvoice.invoiceNumber || matchingInvoice.number;
      reg.amount = Number(reg.amount || matchingInvoice.total || matchingInvoice.amount || matchingInvoice.totalAmount || 0);
      reg.matchedInvoice = matchingInvoice;
      if (matchingInvoice.tournamentName && !reg.tournamentName) {
        reg.tournamentName = matchingInvoice.tournamentName;
      }

      confirmedRegistrations.push(reg);
      if (tId) confirmedTournamentIds.add(tId);
      if (tName.length >= 3) confirmedTournamentNames.add(tName.toLowerCase());
      return;
    }

    if (isRegistrationConfirmed(reg, locallyConfirmedIds, allInvoices)) {
      confirmedRegistrations.push(reg);
      if (tId) confirmedTournamentIds.add(tId);
      if (tName.length >= 3) confirmedTournamentNames.add(tName.toLowerCase());
    } else {
      // Exclude if user previously deleted this pending registration
      if (rid && deletedIds.includes(rid)) return;
      candidatePendingRegistrations.push(reg);
    }
  });

  // 2. Synthesize missing confirmed entries from tournament invoices
  // ANY invoice that represents a paid entry MUST appear in the Confirmed list!
  allInvoices.forEach((inv: any) => {
    const invId = inv._id || inv.id;
    if (invId && matchedInvoiceIds.has(invId)) return; // Already linked to a confirmed registration

    // Check if this invoice is for a tournament/registration
    if (!isTournamentInvoice(inv)) return;

    const invTournId = String(
      inv.tournamentId?._id || 
      inv.tournamentId || 
      inv.tournament_id || 
      inv.tournament?._id || 
      inv.tournament || 
      inv.metadata?.tournamentId || 
      inv.metadata?.tournament_id || 
      ''
    ).trim();

    const invRegId = String(
      inv.registrationId || 
      inv.registration_id || 
      inv.registration?._id || 
      inv.registration || 
      inv.metadata?.registrationId || 
      inv.metadata?.registration_id || 
      inv.bookingId || 
      inv.booking_id || 
      inv.referenceId || 
      inv.reference_id || 
      ''
    ).trim();

    const invTournName = String(
      inv.tournamentName || 
      inv.tournament_name || 
      inv.tournament?.name || 
      inv.tournament?.title || 
      inv.metadata?.tournamentName || 
      inv.metadata?.tournament_name || 
      inv.items?.[0]?.name || 
      inv.items?.[0]?.tournamentName || 
      inv.title || 
      inv.name || 
      inv.description || 
      ''
    ).trim();

    // Check if an existing confirmed registration already has this registration ID, tournament ID or name
    const existing = confirmedRegistrations.find(r => {
      const rid = String(r._id || r.id || '').trim();
      const rTid = String(r.tournamentId?._id || r.tournamentId || r.tournament?._id || r.tournament || '').trim();
      const rName = String(r.tournament?.name || r.tournamentName || r.tournamentId?.name || '').trim().toLowerCase();

      if (invRegId && rid && (rid === invRegId || rid.includes(invRegId) || invRegId.includes(rid))) return true;
      if (invTournId && rTid && (rTid === invTournId || rTid.includes(invTournId) || invTournId.includes(rTid))) return true;
      if (invTournName.length >= 4 && rName.length >= 4 && (rName.includes(invTournName.toLowerCase()) || invTournName.toLowerCase().includes(rName))) return true;
      return false;
    });

    if (existing) {
      if (!existing.invoiceId) existing.invoiceId = invId;
      if (!existing.invoiceNumber) existing.invoiceNumber = inv.invoiceNumber || inv.number;
      if (!existing.matchedInvoice) existing.matchedInvoice = inv;
      if (invId) matchedInvoiceIds.add(invId);
      return;
    }

    // Synthesize a confirmed registration record directly from the paid invoice
    const targetRegId = invRegId || invId || `tourn_reg_${Date.now()}`;
    const displayTournamentName = invTournName || (invTournId ? `Tournament #${invTournId.slice(-6)}` : 'Tournament Registration');

    const synthReg = {
      _id: targetRegId,
      id: targetRegId,
      registrationId: targetRegId,
      tournamentId: inv.tournament || inv.tournamentId || {
        _id: invTournId || `synth_t_${invId}`,
        name: displayTournamentName,
      },
      tournamentName: displayTournamentName,
      categoryName: String(
        inv.categoryName || 
        inv.category_name || 
        inv.category?.name || 
        inv.category || 
        inv.metadata?.categoryName || 
        inv.metadata?.category || 
        'Confirmed Entry'
      ),
      childName: String(
        inv.participantName || 
        inv.participant_name || 
        inv.childName || 
        inv.child_name || 
        inv.metadata?.participantName || 
        inv.metadata?.childName || 
        ''
      ),
      participantName: String(
        inv.participantName || 
        inv.participant_name || 
        inv.childName || 
        inv.child_name || 
        inv.metadata?.participantName || 
        'Athlete'
      ),
      phone: String(
        inv.phone || 
        inv.mobileNumber || 
        inv.mobile_number || 
        inv.customerPhone || 
        inv.user?.phone || 
        ''
      ),
      email: String(inv.email || inv.user?.email || ''),
      amount: Number(inv.total || inv.amount || inv.totalAmount || inv.subtotal || 0),
      fee: Number(inv.total || inv.amount || inv.totalAmount || inv.subtotal || 0),
      paymentStatus: 'PAID',
      registrationStatus: 'CONFIRMED',
      status: 'CONFIRMED',
      isPaid: true,
      createdAt: inv.createdAt || inv.date || inv.invoiceDate || new Date().toISOString(),
      invoiceId: invId,
      invoiceNumber: inv.invoiceNumber || inv.number || '',
      matchedInvoice: inv,
      isFromInvoice: true,
    };

    confirmedRegistrations.push(synthReg);
    if (invId) matchedInvoiceIds.add(invId);
    if (invTournId) confirmedTournamentIds.add(invTournId);
    if (displayTournamentName.length >= 3) confirmedTournamentNames.add(displayTournamentName.toLowerCase());
  });

  // 3. Filter pending registrations (suppress any obsolete ghost pending record if tournament is already confirmed)
  const pendingRegistrations = candidatePendingRegistrations.filter((reg: any) => {
    const tId = String(reg.tournamentId?._id || reg.tournamentId || reg.tournament?._id || reg.tournament || '').trim();
    const tName = String(reg.tournament?.name || reg.tournamentName || reg.tournamentId?.name || '').trim().toLowerCase();

    if (tId && confirmedTournamentIds.has(tId)) return false;
    if (tName && tName.length >= 3 && confirmedTournamentNames.has(tName)) return false;

    return true;
  });

  // 4. Calculate total paid amount
  let totalPaidAmount = 0;
  confirmedRegistrations.forEach((reg: any) => {
    totalPaidAmount += Number(reg.amount || reg.fee || 0);
  });

  return {
    confirmedRegistrations,
    pendingRegistrations,
    allInvoices,
    totalPaidAmount,
  };
};
