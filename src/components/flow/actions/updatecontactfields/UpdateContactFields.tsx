import { SetContactFields } from 'flowTypes';
import * as React from 'react';
import { emphasize } from 'utils';

import styles from './UpdateContactFields.module.scss';

export const MAX_TO_SHOW = 5;

const UpdateContactFieldsComp: React.SFC<SetContactFields> = (
  action: SetContactFields
): JSX.Element => {
  const fields = action.fields || [];

  if (!fields.length) {
    return null;
  }

  const shown = fields.slice(0, MAX_TO_SHOW);
  const remaining = fields.length - shown.length;

  return (
    <div className={styles.fields}>
      {shown.map((entry, index) => (
        <div className={styles.field} key={`${entry.field.key}-${index}`}>
          <div className={styles.name}>{emphasize(entry.field.name)}</div>
          <div className={styles.equals}>=</div>
          <div className={styles.value}>
            {entry.value ? emphasize(entry.value) : <span className={styles.unset}>not set</span>}
          </div>
        </div>
      ))}
      {remaining > 0 ? <div className={styles.more}>+{remaining} more</div> : null}
    </div>
  );
};

export default UpdateContactFieldsComp;
