import type { DayPlan, SwapOption } from "../types";
import { formatDate, formatMoney } from "../format";

type DayCardProps = {
  day: DayPlan;
  swap?: SwapOption;
  onSwap: () => void;
};

export default function DayCard({ day, swap, onSwap }: DayCardProps) {
  return (
    <article className="day">
      <header className="day-header">
        <h2>{formatDate(day.date)}</h2>
        <p>{formatMoney(day.dayCostUsd)}</p>
      </header>
      <ol className="activities">
        {day.activities.map((activity) => (
          <li key={activity.id}>
            {activity.travelMinFromPrevious > 0 && (
              <p className="travel">{activity.travelMinFromPrevious} min travel</p>
            )}
            <div className="activity">
              <div>
                <p className="time">
                  {activity.startTime}–{activity.endTime}
                  <span>{activity.category}</span>
                </p>
                <h3>{activity.name}</h3>
                <p className="summary">{activity.summary}</p>
              </div>
              <p className="price">
                {formatMoney(activity.priceUsd)}
                <span>{activity.rating.toFixed(1)}</span>
              </p>
            </div>
          </li>
        ))}
      </ol>
      {swap && (
        <button type="button" className="button secondary" onClick={onSwap}>
          Cheaper swap: {swap.replacement.name} ({formatMoney(swap.replacement.priceUsd)})
        </button>
      )}
    </article>
  );
}
