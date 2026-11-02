import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { StaffDto, StaffInput, StaffUpdate } from '@booking/shared';
import { api } from '../lib/api';

const KEY = ['staff'] as const;

export function useStaffList() {
  return useQuery({
    queryKey: KEY,
    queryFn: async () =>
      (await api.get<StaffDto[]>('/staff', { params: { includeInactive: true } })).data,
  });
}

export function useSaveStaff() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }: { id?: string; input: StaffInput | StaffUpdate }) =>
      id
        ? (await api.patch<StaffDto>(`/staff/${id}`, input)).data
        : (await api.post<StaffDto>('/staff', input)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useDeleteStaff() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/staff/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
