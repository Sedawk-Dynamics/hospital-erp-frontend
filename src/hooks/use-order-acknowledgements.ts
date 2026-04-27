import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';

export interface OrderAcknowledgement {
  id: string;
  orderType: 'lab' | 'imaging';
  createdAt: string;
  patient?: { id: string; mrn: string; firstName: string; lastName: string | null };
  visit?: { id: string };
  acknowledgement: {
    noteId: string;
    acknowledgedBy: { id: string; firstName: string; lastName: string | null };
    acknowledgedAt: string;
  } | null;
  [key: string]: unknown;
}

export interface ListAcksQuery {
  scope?: 'mine' | 'ward' | 'all';
  wardId?: string;
  status?: 'pending' | 'acknowledged' | 'all';
  orderType?: 'lab' | 'imaging' | 'all';
  limit?: number;
}

export function useOrderAcknowledgements(query: ListAcksQuery = {}) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== '') {
      search.set(key, String(value));
    }
  }
  const qs = search.toString();

  return useQuery({
    queryKey: ['order-acknowledgements', query],
    queryFn: async () => {
      const res = await apiGet<{ orders: OrderAcknowledgement[]; total: number }>(
        `/clinical/orders/acknowledgements${qs ? `?${qs}` : ''}`,
      );
      return res.data;
    },
  });
}
