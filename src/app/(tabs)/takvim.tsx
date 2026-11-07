import { useMemo } from 'react';
import { Text, View } from 'react-native';
import { MineFilter } from '@/components/Assign';
import { TaskRow } from '@/components/TaskRow';
import { C, Card, Empty, Muted, PeriodBar, s, Screen } from '@/components/ui';
import { useStore } from '@/lib/store';
import { allTasks, daysLeftText, formatDate, TASK_LABEL } from '@/lib/tax';
import { Task, TaskType } from '@/lib/types';

export default function Calendar() {
  const { visibleClients, period, statusOf } = useStore();
  const tasks = useMemo(() => allTasks(visibleClients, period), [visibleClients, period]);

  const groups = useMemo(() => {
    const m = new Map<TaskType, Task[]>();
    for (const t of tasks) m.set(t.type, [...(m.get(t.type) ?? []), t]);
    return [...m.entries()];
  }, [tasks]);

  return (
    <Screen>
      <MineFilter />
      <PeriodBar />
      {groups.length === 0 && <Empty text="Bu dönem için beyanname yok." />}
      {groups.map(([type, list]) => {
        const done = list.filter((t) => statusOf(t.key) === 'verildi').length;
        const pct = list.length ? done / list.length : 0;
        const deadline = list[0].deadline;
        return (
          <Card key={type}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <View style={{ flex: 1 }}>
                <Text style={s.title}>{TASK_LABEL[type]}</Text>
                <Muted>Son gün: {formatDate(deadline)}{done < list.length ? ` · ${daysLeftText(deadline)}` : ''}</Muted>
                {list[0].deadlineNote ? <Muted style={{ color: C.amber }}>ⓘ {list[0].deadlineNote}</Muted> : null}
              </View>
              <Text style={{ fontSize: 18, fontWeight: '800', color: done === list.length ? C.green : C.text }}>
                {done}/{list.length}
              </Text>
            </View>
            <View style={{ height: 8, backgroundColor: C.graySoft, borderRadius: 4, marginVertical: 10, overflow: 'hidden' }}>
              <View style={{ width: `${pct * 100}%`, height: '100%', backgroundColor: done === list.length ? C.green : C.primary }} />
            </View>
            {list.map((t, i) => <TaskRow key={t.key} task={t} last={i === list.length - 1} compact />)}
          </Card>
        );
      })}
      <Muted style={{ textAlign: 'center', marginTop: 8 }}>
        Hafta sonu ve resmî tatile denk gelen son günler ilk iş gününe kaydırılır. Arife (yarım gün) kaydırılmaz. GİB&apos;in ayrıca duyurduğu süre uzatmaları için GİB vergi takvimini kontrol edin.
      </Muted>
    </Screen>
  );
}
