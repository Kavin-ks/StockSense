import { StatusBadge } from './ui.jsx';

/** Groups items into columns by `groupKey`; `renderCard` draws each card. */
export function KanbanBoard({ columns, items, groupKey = 'status', renderCard, onCardClick }) {
  return (
    <div className="kanban">
      {columns.map((col) => {
        const cards = items.filter((i) => i[groupKey] === col);
        return (
          <section key={col} className="kanban-col">
            <header><StatusBadge status={col} /><span className="muted">{cards.length}</span></header>
            {cards.map((item) => (
              <article key={item.id} className="kanban-card" tabIndex={0}
                onClick={() => onCardClick?.(item)} onKeyDown={(e) => e.key === 'Enter' && onCardClick?.(item)}>
                {renderCard(item)}
              </article>
            ))}
          </section>
        );
      })}
    </div>
  );
}
