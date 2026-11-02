import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CustomerDetailDto,
  CustomerDto,
  CustomerInput,
  CustomerUpdate,
  Page,
} from '@booking/shared';
import { api } from '../lib/api';

const KEY = ['customers'] as const;
export const CUSTOMERS_PAGE_SIZE = 20;

export function useCustomers(q: string, page: number) {
  return useQuery({
    queryKey: [...KEY, 'list', q, page],
    queryFn: async () =>
      (
        await api.get<Page<CustomerDto>>('/customers', {
          params: {
            q: q || undefined,
            limit: CUSTOMERS_PAGE_SIZE,
            offset: page * CUSTOMERS_PAGE_SIZE,
          },
        })
      ).data,
    placeholderData: keepPreviousData,
  });
}

export function useCustomer(id: string | undefined) {
  return useQuery({
    queryKey: [...KEY, 'detail', id],
    queryFn: async () => (await api.get<CustomerDetailDto>(`/customers/${id}`)).data,
    enabled: !!id,
  });
}

export function useSaveCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }: { id?: string; input: CustomerInput | CustomerUpdate }) =>
      id
        ? (await api.patch<CustomerDto>(`/customers/${id}`, input)).data
        : (await api.post<CustomerDto>('/customers', input)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useDeleteCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/customers/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
