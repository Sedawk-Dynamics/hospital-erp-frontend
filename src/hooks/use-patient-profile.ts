import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiPut } from '@/lib/api';
import type { ProfileEditValues } from '@/lib/schema/profile-edit-schema';


export function useUpdatePatientProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<ProfileEditValues> }) =>
      (await apiPut(`/patient-portal/profile/${id}`, data)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['patient', 'profile'] });
      qc.invalidateQueries({ queryKey: ['patient', 'profiles'] });
    },
  });
}
