import { toast } from 'sonner';
import { supabase } from '../supabaseClient';

// A car with a won deal cannot leave 'sold' — the DB refuses it
// (trg_guard_sold_car, migration 20260924a). Flipping it back by hand used to
// relist the car while its customer, handover steps and commission stayed, the
// won = sold rule broken in reverse. The only way out is undo_car_sale(), which
// reopens the deal (won -> negotiating) and relists the car in one step.
// Every status control that can hit the guard routes through here, so the
// message and the way out are the same on every surface.

export const isWonDealBlock = (err) => /car_has_won_deal/.test(err?.message || '');

export async function undoCarSale(listingId) {
  const { data, error } = await supabase.rpc('undo_car_sale', { p_listing_id: listingId });
  if (error) {
    const m = error.message || '';
    toast.error(
      m.includes('sale_has_service_packages')
        ? 'A service package was sold on this deal. Remove it before undoing the sale.'
        : m.includes('not_allowed')
          ? 'Only the dealer, a manager or the salesman who closed it can undo this sale.'
          : 'Could not undo the sale. Try again.'
    );
    return null;
  }
  return data;
}

// Shown when a status change hits the guard. onUndone runs after a successful
// undo so the caller can update its own state (car -> available, deal ->
// negotiating) without a reload.
export function offerUndoSale(listingId, onUndone) {
  toast.error('This car has a won deal, so it stays sold.', {
    description: 'Undo the sale to reopen the deal (it moves back to Negotiating) and put the car back on sale.',
    duration: 10000,
    action: {
      label: 'Undo sale',
      onClick: async () => {
        const res = await undoCarSale(listingId);
        if (!res) return;
        toast.success('Sale undone. The deal is back in Negotiating.');
        onUndone?.(res);
      },
    },
  });
}

// Local-state helpers shared by the panels after an undo.
export const relistCar = (listingId) => (cars) =>
  cars.map((c) => (c.id === listingId ? { ...c, status: 'available', sold_at: null, sold_date: null } : c));

export const reopenWonLeads = (listingId) => (leads) =>
  leads.map((l) =>
    l.car_listing_id === listingId && (l.stage === 'won' || l.stage === 'closed_won')
      ? { ...l, stage: 'negotiating' }
      : l
  );
