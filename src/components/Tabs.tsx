import React from 'react';
import style from '../scss/app.scss';

function addClassOnlyFor(allIds: string[], forId: string, className: string) {
  for (const f of allIds) {
    const el = document.getElementById(f);
    if (el) {
      el.classList.remove(className);
    }
  }
  const el = document.getElementById(forId);
  if (el) {
    el.classList.add(className);
  }
}
function removeClassOnlyFor(
  allIds: string[],
  forId: string,
  className: string,
) {
  for (const f of allIds) {
    const el = document.getElementById(f);
    if (el) {
      el.classList.add(className);
    }
  }
  const el = document.getElementById(forId);
  if (el) {
    el.classList.remove(className);
  }
}

const Tabs = (props: {
  tabs: string[];
  for: string[];
  value: number;
  style?: React.CSSProperties;
  id?: string;
}) => {
  const [value, setValue] = React.useState<number>(props.value);

  React.useEffect(() => {
    removeClassOnlyFor(props.for, props.for[value], style.collapsedTab);
    addClassOnlyFor(props.tabs, props.tabs[value], style.active);
  }, [value]);

  return (
    <div id={props.id} className={style.tabChooser} style={props.style}>
      {props.tabs.map((tab, i) => {
        return (
          <span
            key={tab}
            className={i === value ? style.active : ''}
            onClick={(e) => {
              setValue(i);
            }}
          >
            {tab}
          </span>
        );
      })}
    </div>
  );
};

Tabs.defaultProps = {
  value: 0,
};

export default Tabs;
