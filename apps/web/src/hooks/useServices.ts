import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ServiceDto, ServiceInput, ServiceUpdate } from '@booking/shared';
import { api } from '../lib/api';

const KEY = ['services'] as const;

export function useServices() {
  return useQuery({
    queryKey: KEY,
    queryFn: async () =>
      (await api.get<ServiceDto[]>('/services', { params: { includeInactive: true } })).data,
  });
}

export function useSaveService() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }: { id?: string; input: ServiceInput | ServiceUpdate }) =>
      id
        ? (await api.patch<ServiceDto>(`/services/${id}`, input)).data
        : (await api.post<ServiceDto>('/services', input)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useDeleteService() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/services/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
