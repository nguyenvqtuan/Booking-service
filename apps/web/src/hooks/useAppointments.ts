import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  AppointmentCreate,
  AppointmentDto,
  AppointmentStatusChange,
  AppointmentUpdate,
} from '@booking/shared';
import { api } from '../lib/api';

const KEY = ['appointments'] as const;

export function useAppointments(
  range: { from: string; to: string; staffId?: string },
  options: { enabled?: boolean } = {},
) {
  return useQuery({
    queryKey: [...KEY, range],
    queryFn: async () => (await api.get<AppointmentDto[]>('/appointments', { params: range })).data,
    enabled: options.enabled ?? true,
  });
}

export function useSaveAppointment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      input,
    }: {
      id?: string;
      input: AppointmentCreate | AppointmentUpdate;
    }) =>
      id
        ? (await api.patch<AppointmentDto>(`/appointments/${id}`, input)).data
        : (await api.post<AppointmentDto>('/appointments', input)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useChangeAppointmentStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string } & AppointmentStatusChange) =>
      (await api.post<AppointmentDto>(`/appointments/${id}/status`, { status })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
