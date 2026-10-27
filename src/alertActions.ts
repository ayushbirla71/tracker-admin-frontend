import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api, del } from './api';
import { useConfirm, useErrorToast, useToast } from './feedback';

export type ClearScope = 'read' | 'all';

/** Clearing deletes alerts for every admin; issues that are still ongoing are kept by the server. */
export function useAlertActions() {
  const qc = useQueryClient();
  const toast = useToast();
  const confirm = useConfirm();
  const onError = useErrorToast();

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['alerts'] });
    qc.invalidateQueries({ queryKey: ['dashboard'] });
  };

  const clearMutation = useMutation({
    mutationFn: (scope: ClearScope) => api<{ deleted: number }>(`/alerts?scope=${scope}`, { method: 'DELETE' }),
    onSuccess: ({ deleted }) => {
      toast('success', deleted === 0 ? 'Nothing to clear' : `Cleared ${deleted} alert${deleted === 1 ? '' : 's'}`, deleted === 0 ? 'Ongoing issues stay until they are resolved.' : undefined);
      refresh();
    },
    onError,
  });

  const dismissMutation = useMutation({
    mutationFn: (id: string) => del(`/alerts/${id}`),
    onSuccess: refresh,
    onError,
  });

  const clear = async (scope: ClearScope) => {
    if (scope === 'all') {
      const ok = await confirm({
        title: 'Clear all alerts?',
        message: 'This removes every alert for all admins. Issues that are still ongoing (like a worker being offline) stay until they are resolved.',
        confirmLabel: 'Clear all',
        danger: true,
      });
      if (!ok) return;
    }
    clearMutation.mutate(scope);
  };

  return { clear, dismiss: (id: string) => dismissMutation.mutate(id), busy: clearMutation.isPending || dismissMutation.isPending };
}
