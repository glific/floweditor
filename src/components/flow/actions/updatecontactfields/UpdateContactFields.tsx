import { SetContactFields } from 'flowTypes';
import * as React from 'react';
import { emphasize } from 'utils';

import styles from './UpdateContactFields.module.scss';

const UpdateContactFieldsComp: React.SFC<SetContactFields> = (
  action: SetContactFields
): JSX.Element => {
  const fields = action.fields || [];

  if (!fields.length) {
    return null;
  }

  return (
    <div className={styles.fields}>
      {fields.map(entry => (
        <div className={styles.field} key={entry.field.key}>
          {emphasize(entry.field.name)} = {entry.value ? emphasize(entry.value) : '—'}
        </div>
      ))}
    </div>
  );
};

export default UpdateContactFieldsComp;
