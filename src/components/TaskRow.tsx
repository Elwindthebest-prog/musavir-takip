import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { useStore } from '@/lib/store';
import { daysLeft, daysLeftText, formatDate, TASK_LABEL } from '@/lib/tax';
import { NEXT_STATUS, Task } from '@/lib/types';
import { C, Muted, s, StatusChip } from './ui';

/** compact: Takvim kartında tür ve son gün başlıkta yazdığı için satırda tekrar edilmez */
export function TaskRow({ task, showClient = true, last, compact }: { task: Task; showClient?: boolean; last?: boolean; compact?: boolean }) {
  const { statusOf, setStatus, getClient, team, mine, memberLabel } = useStore();
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
        {compact ? (
          team && !mine && memberLabel(client?.sorumlu) ? <Muted>👤 {memberLabel(client?.sorumlu)}</Muted> : null
        ) : (
        <Muted>
          {showClient ? `${TASK_LABEL[task.type]} · ` : ''}
          {formatDate(task.deadline, false)}
          {showClient && team && !mine && memberLabel(client?.sorumlu) ? ` · 👤 ${memberLabel(client?.sorumlu)}` : ''}
          {status !== 'verildi' ? (
            <Text style={{ color: urgent ? (n < 0 ? C.red : C.amber) : C.muted, fontWeight: urgent ? '700' : '400' }}>
              {' · '}{daysLeftText(task.deadline)}
            </Text>
          ) : null}
        </Muted>
        )}
        {!compact && task.deadlineNote && status !== 'verildi' ? (
          <Text style={{ fontSize: 12, color: C.amber, marginTop: 2 }}>ⓘ {task.deadlineNote}</Text>
        ) : null}
      </Pressable>
      <StatusChip
        status={status}
        deadline={task.deadline}
        onPress={() => setStatus(task.key, NEXT_STATUS[status])}
      />
    </View>
  );
}
