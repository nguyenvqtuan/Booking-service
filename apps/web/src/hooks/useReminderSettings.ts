import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ReminderSettingsDto, ReminderSettingsInput } from '@booking/shared';
import { api } from '../lib/api';

const KEY = ['reminder-settings'] as const;

export function useReminderSettings() {
  return useQuery({
    queryKey: KEY,
    queryFn: async () => (await api.get<ReminderSettingsDto>('/reminder-settings')).data,
  });
}

export function useSaveReminderSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: ReminderSettingsInput) =>
      (await api.put<ReminderSettingsDto>('/reminder-settings', input)).data,
    onSuccess: (data) => qc.setQueryData(KEY, data),
  });
}
