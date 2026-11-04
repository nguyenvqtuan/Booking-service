import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ReportMonth } from '@booking/shared';
import { currentLocale } from '../../i18n';
import { monthLabel, niceMax } from './chart-helpers';

const SLOT_WIDTH = 64;
const BAR_WIDTH = 24;
const HEIGHT = 240;
const TOP = 16;
const BOTTOM = 28;
const LEFT = 36;
const RADIUS = 4;
/** Surface gap between stacked segments. */
const GAP = 2;

/** Column with a rounded data end and a square baseline. */
function roundedTop(x: number, y: number, width: number, height: number): string {
  const r = Math.min(RADIUS, height);
  return `M${x},${y + height}V${y + r}Q${x},${y} ${x + r},${y}H${x + width - r}Q${x + width},${y} ${x + width},${y + r}V${y + height}Z`;
}

/** Completed vs no-show per month, as stacked columns on one axis. */
export function MonthlyOutcomesChart({ months }: { months: ReportMonth[] }) {
  const { t } = useTranslation('reports');
  const [active, setActive] = useState<number | null>(null);
  const locale = currentLocale();
  const plotRef = useRef<HTMLDivElement>(null);

  // On narrow screens the plot scrolls: start at the most recent months.
  useEffect(() => {
    const plot = plotRef.current;
    if (plot) plot.scrollLeft = plot.scrollWidth;
  }, [months.length]);

  const width = LEFT + months.length * SLOT_WIDTH;
  const plotHeight = HEIGHT - TOP - BOTTOM;
  const max = niceMax(Math.max(...months.map((m) => m.completed + m.noShow), 1));
  const y = (value: number) => TOP + plotHeight - (value / max) * plotHeight;
  const ticks = [0, 1, 2, 3, 4].map((i) => (max / 4) * i);
  const current = active === null ? null : months[active];

  return (
    <figure className="viz">
      <figcaption className="viz-title">{t('chart.title')}</figcaption>
      <ul className="viz-legend">
        <li>
          <span className="viz-swatch viz-completed" aria-hidden="true" />
          {t('completed')}
        </li>
        <li>
          <span className="viz-swatch viz-no-show" aria-hidden="true" />
          {t('noShow')}
        </li>
      </ul>
      <div className="viz-plot" ref={plotRef}>
        <svg
          viewBox={`0 0 ${width} ${HEIGHT}`}
          width={width}
          height={HEIGHT}
          role="img"
          aria-label={t('chart.title')}
        >
          {ticks.map((tick) => (
            <g key={tick}>
              <line className="viz-grid" x1={LEFT} x2={width} y1={y(tick)} y2={y(tick)} />
              <text className="viz-axis" x={LEFT - 8} y={y(tick) + 4} textAnchor="end">
                {tick}
              </text>
            </g>
          ))}
          {months.map((m, i) => {
            const x = LEFT + i * SLOT_WIDTH + (SLOT_WIDTH - BAR_WIDTH) / 2;
            const completedTop = y(m.completed);
            const completedHeight = TOP + plotHeight - completedTop;
            const noShowHeight = (m.noShow / max) * plotHeight;
            const noShowTop = completedTop - noShowHeight - (m.completed > 0 ? GAP : 0);
            return (
              <g
                key={m.month}
                tabIndex={0}
                role="img"
                aria-label={`${monthLabel(m.month, locale)}: ${t('completed')} ${m.completed}, ${t('noShow')} ${m.noShow}`}
                onMouseEnter={() => setActive(i)}
                onMouseLeave={() => setActive(null)}
                onFocus={() => setActive(i)}
                onBlur={() => setActive(null)}
                data-testid={`month-${m.month}`}
              >
                {/* Hit target larger than the mark. */}
                <rect
                  x={LEFT + i * SLOT_WIDTH}
                  y={TOP}
                  width={SLOT_WIDTH}
                  height={plotHeight}
                  fill="transparent"
                />
                {m.completed > 0 && (
                  <path
                    className="viz-completed"
                    d={
                      m.noShow > 0
                        ? `M${x},${completedTop}h${BAR_WIDTH}v${completedHeight}h${-BAR_WIDTH}Z`
                        : roundedTop(x, completedTop, BAR_WIDTH, completedHeight)
                    }
                  />
                )}
                {m.noShow > 0 && (
                  <path
                    className="viz-no-show"
                    d={roundedTop(x, noShowTop, BAR_WIDTH, noShowHeight)}
                  />
                )}
                <text
                  className="viz-axis"
                  x={LEFT + i * SLOT_WIDTH + SLOT_WIDTH / 2}
                  y={HEIGHT - 8}
                  textAnchor="middle"
                >
                  {monthLabel(m.month, locale)}
                </text>
              </g>
            );
          })}
        </svg>
        {current && active !== null && (
          <div
            className="viz-tooltip"
            role="status"
            // Beside the column, never over it; the last columns open towards the left.
            style={
              active >= months.length - 2 && active > 0
                ? { left: LEFT + active * SLOT_WIDTH, transform: 'translateX(-100%)' }
                : { left: LEFT + (active + 1) * SLOT_WIDTH }
            }
          >
            <strong>{monthLabel(current.month, locale)}</strong>
            <span>
              {t('completed')}: {current.completed}
            </span>
            <span>
              {t('noShow')}: {current.noShow}
            </span>
          </div>
        )}
      </div>
    </figure>
  );
}
