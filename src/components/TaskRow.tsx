import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { useStore } from '@/lib/store';
import { daysLeft, daysLeftText, formatDate, TASK_LABEL } from '@/lib/tax';
import { NEXT_STATUS, Task } from '@/lib/types';
import { C, Muted, s, StatusChip } from './ui';

export function TaskRow({ task, showClient = true, last }: { task: Task; showClient?: boolean; last?: boolean }) {
  const { statusOf, setStatus, getClient } = useStore();
  const status = statusOf(task.key);
  const client = getClient(task.clientId);
  const n = daysLeft(task.deadline);
  const urgent = status !== 'verildi' && n <= 3;

  return (
    <View style={[s.row, last && { borderBottomWidth: 0 }]}>
      <Pressable
        style={{ flex: 1 }}
        disabled={!showClient}
        onPress={() => router.push(`/mukellef/${task.clientId}`)}
      >
        <Text style={s.rowTitle} numberOfLines={1}>
          {showClient ? client?.unvan ?? '—' : TASK_LABEL[task.type]}
        </Text>
        <Muted>
          {showClient ? `${TASK_LABEL[task.type]} · ` : ''}
          {formatDate(task.deadline)}
          {status !== 'verildi' ? (
            <Text style={{ color: urgent ? (n < 0 ? C.red : C.amber) : C.muted, fontWeight: urgent ? '700' : '400' }}>
              {' · '}{daysLeftText(task.deadline)}
            </Text>
          ) : null}
        </Muted>
      </Pressable>
      <StatusChip
        status={status}
        deadline={task.deadline}
        onPress={() => setStatus(task.key, NEXT_STATUS[status])}
      />
    </View>
  );
}
