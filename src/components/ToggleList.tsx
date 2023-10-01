import React from 'react';
import style from '../scss/app.scss';

const ToggleList = (props: {
  list: string[][];
  id: string;
  default: Set<string>;
  setChecked: (checked: Set<string>) => void;
}) => {
  const [checkedElements, setChecked] = React.useState<Set<string>>(props.default);

  const toggle = (element: string) => {
    const newChecked = new Set(checkedElements);
    if (newChecked.has(element)) {
      newChecked.delete(element);
    } else {
      newChecked.add(element);
    }
    setChecked(newChecked);
    props.setChecked(newChecked);
  };

  return (
    <table id={props.id} className={style.toggleList}>
      <tbody>
        {props.list.map((element, i) => (
          <tr
            key={`${props.id}-${i}`}
            onClick={() => {
              toggle(element[0]);
            }}
          >
            {element.map((e, j) => (
              <td key={`${props.id}-${i}-${j}`}>{e}</td>
            ))}
            <td>
              <input
                type="checkbox"
                onChange={() => {
                  toggle(element[0]);
                }}
                checked={checkedElements.has(element[0])}
              />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

ToggleList.defaultProps = {
  default: new Set<string>(),
};

export default ToggleList;
